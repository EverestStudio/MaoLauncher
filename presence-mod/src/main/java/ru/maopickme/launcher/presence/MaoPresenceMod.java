package ru.maopickme.launcher.presence;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

public final class MaoPresenceMod implements ModInitializer {
    public static final CustomPacketPayload.Type<PresencePayload> PRESENCE_TYPE =
        new CustomPacketPayload.Type<>(Identifier.fromNamespaceAndPath("mao", "presence"));

    public static final StreamCodec<RegistryFriendlyByteBuf, PresencePayload> PRESENCE_CODEC =
        StreamCodec.of(
            (buffer, payload) -> buffer.writeUtf(payload.token(), 64),
            buffer -> new PresencePayload(buffer.readUtf(64))
        );

    @Override
    public void onInitialize() {
        PayloadTypeRegistry.serverboundPlay().register(PRESENCE_TYPE, PRESENCE_CODEC);
    }

    public record PresencePayload(String token) implements CustomPacketPayload {
        @Override
        public Type<? extends CustomPacketPayload> type() {
            return PRESENCE_TYPE;
        }
    }
}
