package ru.maopickme.launcher.presence;

import java.util.regex.Pattern;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;

public final class MaoPresenceClient implements ClientModInitializer {
    private static final Pattern TOKEN_PATTERN = Pattern.compile("^[a-fA-F0-9]{64}$");

    @Override
    public void onInitializeClient() {
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            String token = System.getProperty("mao.launcher.presence", "");
            if (!TOKEN_PATTERN.matcher(token).matches()) return;
            if (!ClientPlayNetworking.canSend(MaoPresenceMod.PRESENCE_TYPE)) return;
            ClientPlayNetworking.send(new MaoPresenceMod.PresencePayload(token));
        });
    }
}
