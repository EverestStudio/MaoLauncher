package ru.maopickme.presence;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import net.kyori.adventure.text.Component;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;

public final class MaoLauncherPresencePlugin extends JavaPlugin implements Listener, PluginMessageListener {
    private static final String CHANNEL = "mao:presence";
    private static final Pattern TOKEN = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final String GLYPH = "\uE000";
    private final Map<UUID, String> originalNames = new ConcurrentHashMap<>();
    private final Map<UUID, Long> lastMessage = new ConcurrentHashMap<>();

    @Override
    public void onEnable() {
        saveDefaultConfig();
        getServer().getMessenger().registerIncomingPluginChannel(this, CHANNEL, this);
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("MaoLauncher Presence enabled. Waiting for client presence packets.");
    }

    @Override
    public void onDisable() {
        getServer().getMessenger().unregisterIncomingPluginChannel(this, CHANNEL, this);
        for (Player player : getServer().getOnlinePlayers()) restoreName(player);
        originalNames.clear();
        lastMessage.clear();
    }

    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!CHANNEL.equals(channel) || message == null || message.length > 128) return;
        String token = decodeToken(message);
        if (token == null || !TOKEN.matcher(token).matches()) return;
        long now = System.currentTimeMillis();
        Long previous = lastMessage.put(player.getUniqueId(), now);
        if (previous != null && now - previous < 3000L) return;
        applyName(player);
    }

    private String decodeToken(byte[] data) {
        int length = 0, shift = 0, index = 0;
        while (index < data.length && shift < 35) {
            int value = data[index++] & 0xff;
            length |= (value & 0x7f) << shift;
            if ((value & 0x80) == 0) {
                if (length < 0 || length > 64 || data.length - index != length) return null;
                return new String(data, index, length, StandardCharsets.UTF_8);
            }
            shift += 7;
        }
        return null;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        applyConfiguredResourcePack(event.getPlayer());
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        originalNames.remove(event.getPlayer().getUniqueId());
        lastMessage.remove(event.getPlayer().getUniqueId());
    }

    private void applyName(Player player) {
        originalNames.putIfAbsent(player.getUniqueId(), player.getPlayerListName() == null ? player.getName() : player.getPlayerListName());
        String base = originalNames.get(player.getUniqueId());
        if (!base.startsWith(GLYPH)) player.setPlayerListName(GLYPH + " " + base);
    }

    private void restoreName(Player player) {
        String original = originalNames.remove(player.getUniqueId());
        if (original != null) player.setPlayerListName(original);
    }

    private void applyConfiguredResourcePack(Player player) {
        String url = getConfig().getString("resource-pack.url", "").trim();
        if (url.isEmpty()) return;
        if (!url.startsWith("https://")) {
            getLogger().warning("resource-pack.url must be a direct HTTPS URL.");
            return;
        }
        String sha1 = getConfig().getString("resource-pack.sha1", "").trim();
        byte[] hash = null;
        if (!sha1.isEmpty()) {
            if (!sha1.matches("(?i)^[a-f0-9]{40}$")) {
                getLogger().warning("resource-pack.sha1 must contain exactly 40 hexadecimal characters.");
                return;
            }
            hash = java.util.HexFormat.of().parseHex(sha1);
        }
        boolean required = getConfig().getBoolean("resource-pack.required", false);
        String prompt = getConfig().getString("resource-pack.prompt", "Загрузить ресурс-пак MaoLauncher?");
        player.setResourcePack(url, hash, Component.text(prompt), required);
    }
}
