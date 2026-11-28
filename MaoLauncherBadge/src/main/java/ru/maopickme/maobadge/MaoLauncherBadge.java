package ru.maopickme.maobadge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.Team;
import org.bukkit.plugin.messaging.PluginMessageListener;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class MaoLauncherBadge extends JavaPlugin implements Listener, PluginMessageListener {
    public static final String CHANNEL = "mao:badge";
    private static final String TEAM_PREFIX = "maobadge_";

    private final Map<UUID, String> previousTeams = new HashMap<>();
    private final Map<UUID, Component> previousListNames = new HashMap<>();
    private final Map<String, Long> usedNonces = new HashMap<>();

    private Scoreboard scoreboard;
    private PublicKey verificationKey;
    private NamedTextColor badgeColor;
    private String badgeSymbol;
    private int maxTicketLifetimeSeconds;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        loadSettings();

        scoreboard = Bukkit.getScoreboardManager().getMainScoreboard();
        cleanupStaleTeams();

        Bukkit.getMessenger().registerIncomingPluginChannel(this, CHANNEL, this);
        Bukkit.getPluginManager().registerEvents(this, this);

        getLogger().info("MaoLauncherBadge enabled. Signed-ticket verification: "
                + (verificationKey == null ? "DISABLED (public key not configured)" : "enabled"));
    }

    @Override
    public void onDisable() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            removeBadge(player);
        }
        Bukkit.getMessenger().unregisterIncomingPluginChannel(this, CHANNEL, this);
    }

    private void loadSettings() {
        String encodedKey = getConfig().getString("public-key", "").trim();
        verificationKey = null;

        if (!encodedKey.isBlank() && !encodedKey.startsWith("PASTE_")) {
            try {
                byte[] keyBytes = Base64.getDecoder().decode(encodedKey);
                verificationKey = KeyFactory.getInstance("Ed25519")
                        .generatePublic(new X509EncodedKeySpec(keyBytes));
            } catch (Exception exception) {
                getLogger().severe("Invalid Ed25519 public key in config.yml: " + exception.getMessage());
            }
        }

        badgeSymbol = getConfig().getString("badge.symbol", "◆");
        String colorName = getConfig().getString("badge.color", "LIGHT_PURPLE");
        badgeColor = switch (colorName.toUpperCase()) {
            case "BLACK" -> NamedTextColor.BLACK;
            case "DARK_BLUE" -> NamedTextColor.DARK_BLUE;
            case "DARK_GREEN" -> NamedTextColor.DARK_GREEN;
            case "DARK_AQUA" -> NamedTextColor.DARK_AQUA;
            case "DARK_RED" -> NamedTextColor.DARK_RED;
            case "DARK_PURPLE" -> NamedTextColor.DARK_PURPLE;
            case "GOLD" -> NamedTextColor.GOLD;
            case "GRAY" -> NamedTextColor.GRAY;
            case "DARK_GRAY" -> NamedTextColor.DARK_GRAY;
            case "BLUE" -> NamedTextColor.BLUE;
            case "GREEN" -> NamedTextColor.GREEN;
            case "AQUA" -> NamedTextColor.AQUA;
            case "RED" -> NamedTextColor.RED;
            case "LIGHT_PURPLE" -> NamedTextColor.LIGHT_PURPLE;
            case "YELLOW" -> NamedTextColor.YELLOW;
            case "WHITE" -> NamedTextColor.WHITE;
            default -> NamedTextColor.LIGHT_PURPLE;
        };

        maxTicketLifetimeSeconds = Math.max(30,
                getConfig().getInt("security.max-ticket-lifetime-seconds", 180));
    }

    private void cleanupStaleTeams() {
        for (Team team : Set.copyOf(scoreboard.getTeams())) {
            if (team.getName().startsWith(TEAM_PREFIX)) {
                team.unregister();
            }
        }
    }

    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!CHANNEL.equals(channel) || verificationKey == null || message.length > 2048) {
            return;
        }

        String ticket = new String(message, StandardCharsets.UTF_8).trim();
        if (!verifyTicket(player, ticket)) {
            return;
        }

        grantBadge(player);
    }

    /*
     * Ticket format:
     * base64url(uuid|expiryEpochSeconds|nonce).base64url(ed25519Signature)
     * Signature is calculated over the ASCII bytes of the first segment.
     */
    private boolean verifyTicket(Player player, String ticket) {
        try {
            String[] parts = ticket.split("\\.", -1);
            if (parts.length != 2) {
                return false;
            }

            byte[] payloadBytes = Base64.getUrlDecoder().decode(parts[0]);
            byte[] signatureBytes = Base64.getUrlDecoder().decode(parts[1]);
            String payload = new String(payloadBytes, StandardCharsets.UTF_8);
            String[] fields = payload.split("\\|", -1);
            if (fields.length != 3) {
                return false;
            }

            UUID ticketUuid = UUID.fromString(fields[0]);
            long expiresAt = Long.parseLong(fields[1]);
            String nonce = fields[2];
            long now = Instant.now().getEpochSecond();

            usedNonces.entrySet().removeIf(entry -> entry.getValue() <= now);
            if (!ticketUuid.equals(player.getUniqueId())
                    || nonce.isBlank()
                    || nonce.length() > 96
                    || expiresAt <= now
                    || expiresAt > now + maxTicketLifetimeSeconds
                    || usedNonces.containsKey(nonce)) {
                return false;
            }

            Signature verifier = Signature.getInstance("Ed25519");
            verifier.initVerify(verificationKey);
            verifier.update(parts[0].getBytes(StandardCharsets.US_ASCII));
            if (!verifier.verify(signatureBytes)) {
                return false;
            }

            usedNonces.put(nonce, expiresAt);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void grantBadge(Player player) {
        if (hasBadge(player)) {
            return;
        }

        Team previous = scoreboard.getEntryTeam(player.getName());
        if (previous != null && !previous.getName().startsWith(TEAM_PREFIX)) {
            previousTeams.put(player.getUniqueId(), previous.getName());
        }

        String teamName = TEAM_PREFIX + player.getUniqueId().toString().replace("-", "");
        Team team = scoreboard.getTeam(teamName);
        if (team == null) {
            team = scoreboard.registerNewTeam(teamName);
        }
        team.prefix(Component.text(badgeSymbol + " ").color(badgeColor));
        team.addEntry(player.getName());

        previousListNames.put(player.getUniqueId(), player.playerListName());
        player.playerListName(Component.text(badgeSymbol + " ").color(badgeColor)
                .append(Component.text(player.getName())));
        getLogger().info("Verified MaoLauncher session for " + player.getName());
    }

    private boolean hasBadge(Player player) {
        Team team = scoreboard.getEntryTeam(player.getName());
        return team != null && team.getName().startsWith(TEAM_PREFIX);
    }

    private void removeBadge(Player player) {
        String teamName = TEAM_PREFIX + player.getUniqueId().toString().replace("-", "");
        Team team = scoreboard.getTeam(teamName);
        if (team != null) {
            team.removeEntry(player.getName());
            team.unregister();
        }

        Component originalListName = previousListNames.remove(player.getUniqueId());
        if (originalListName != null) {
            player.playerListName(originalListName);
        }

        String previousTeamName = previousTeams.remove(player.getUniqueId());
        if (previousTeamName != null) {
            Team previousTeam = scoreboard.getTeam(previousTeamName);
            if (previousTeam != null && scoreboard.getEntryTeam(player.getName()) == null) {
                previousTeam.addEntry(player.getName());
            }
        }
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        removeBadge(event.getPlayer());
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!command.getName().equalsIgnoreCase("maobadge")) {
            return false;
        }
        if (!sender.hasPermission("maobadge.admin")) {
            sender.sendMessage(Component.text("Недостаточно прав.").color(NamedTextColor.RED));
            return true;
        }
        if (args.length == 1 && args[0].equalsIgnoreCase("reload")) {
            reloadConfig();
            loadSettings();
            sender.sendMessage(Component.text("MaoLauncherBadge: конфигурация перезагружена.")
                    .color(NamedTextColor.GREEN));
            return true;
        }
        sender.sendMessage(Component.text("Использование: /maobadge reload"));
        return true;
    }
}
