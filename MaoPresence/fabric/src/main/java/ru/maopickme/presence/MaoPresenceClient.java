package ru.maopickme.presence;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

import java.nio.charset.StandardCharsets;

public final class MaoPresenceClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        PayloadTypeRegistry.serverboundPlay().register(PresencePayload.TYPE, PresencePayload.CODEC);
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            String token = System.getProperty("mao.presence.token", "");
            if (!token.matches("[0-9a-f]{64}") || !ClientPlayNetworking.canSend(PresencePayload.TYPE)) return;
            ClientPlayNetworking.send(new PresencePayload(token));
        });
    }

    private record PresencePayload(String token) implements CustomPacketPayload {
        private static final Type<PresencePayload> TYPE =
                new Type<>(Identifier.fromNamespaceAndPath("mao", "presence"));
        private static final StreamCodec<RegistryFriendlyByteBuf, PresencePayload> CODEC =
                StreamCodec.of(
                        (buffer, payload) -> buffer.writeBytes(payload.token().getBytes(StandardCharsets.US_ASCII)),
                        buffer -> {
                            byte[] bytes = new byte[buffer.readableBytes()];
                            buffer.readBytes(bytes);
                            return new PresencePayload(new String(bytes, StandardCharsets.US_ASCII));
                        }
                );
        @Override
        public Type<? extends CustomPacketPayload> type() { return TYPE; }
    }
}
