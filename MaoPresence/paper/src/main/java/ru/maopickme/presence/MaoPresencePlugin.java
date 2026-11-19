package ru.maopickme.presence;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;

import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

public final class MaoPresencePlugin extends JavaPlugin implements Listener, PluginMessageListener {
    private static final String CHANNEL = "mao:presence";
    private static final Pattern TOKEN_PATTERN = Pattern.compile("[0-9a-f]{64}");
    private final Set<UUID> markedPlayers = ConcurrentHashMap.newKeySet();

    @Override
    public void onEnable() {
        getServer().getMessenger().registerIncomingPluginChannel(this, CHANNEL, this);
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("MaoLauncher presence channel enabled.");
    }

    @Override
    public void onDisable() {
        getServer().getMessenger().unregisterIncomingPluginChannel(this, CHANNEL);
        for (Player player : Bukkit.getOnlinePlayers()) {
            if (markedPlayers.contains(player.getUniqueId())) player.playerListName(null);
        }
        markedPlayers.clear();
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        markedPlayers.remove(event.getPlayer().getUniqueId());
    }

    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!CHANNEL.equals(channel) || message.length != 64) return;

        String token = new String(message, StandardCharsets.US_ASCII);
        if (!TOKEN_PATTERN.matcher(token).matches()) return;

        markedPlayers.add(player.getUniqueId());

        player.playerListName(
            Component.text("ﾏ")
                .font(net.kyori.adventure.key.Key.key("mao", "default"))
                .append(
                    Component.text(" ")
                        .font(net.kyori.adventure.key.Key.key("minecraft", "default"))
                )
                .append(
                    Component.text(player.getName(), NamedTextColor.WHITE)
                        .font(net.kyori.adventure.key.Key.key("minecraft", "default"))
                )
        );
        getLogger().fine("MaoLauncher marker enabled for " + player.getName());
    }
}
