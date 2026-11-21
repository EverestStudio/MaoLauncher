package studio.everest.maoauth;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.player.*;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.EntityPickupItemEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class MaoAuthPlugin extends JavaPlugin implements Listener {
    private static final String MENU_TITLE = ChatColor.DARK_PURPLE + "MaoPickMe | Авторизация";
    private final Gson gson = new Gson();
    private final Set<UUID> authenticated = ConcurrentHashMap.newKeySet();
    private final Map<UUID, Prompt> prompts = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> attempts = new ConcurrentHashMap<>();
    private final Map<UUID, BukkitTask> timeouts = new ConcurrentHashMap<>();
    private HttpClient http;

    @Override public void onEnable() {
        saveDefaultConfig();
        http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
        getServer().getPluginManager().registerEvents(this, this);
        Objects.requireNonNull(getCommand("maoauth")).setExecutor((sender, command, label, args) -> {
            if (sender instanceof Player player) openMenu(player);
            else sender.sendMessage("This command is for players.");
            return true;
        });
        getLogger().info("MaoAuth enabled. Configure api-url and server-secret before opening the server.");
    }

    @Override public void onDisable() {
        timeouts.values().forEach(BukkitTask::cancel);
        prompts.clear(); authenticated.clear();
    }

    @EventHandler public void onJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        authenticated.remove(p.getUniqueId());
        p.setWalkSpeed(0f); p.setFlySpeed(0f);
        Bukkit.getScheduler().runTaskLater(this, () -> {
            if (p.isOnline() && !authenticated.contains(p.getUniqueId())) openMenu(p);
        }, 10L);
        BukkitTask timeout = Bukkit.getScheduler().runTaskLater(this, () -> {
            if (p.isOnline() && !authenticated.contains(p.getUniqueId()))
                p.kickPlayer(ChatColor.RED+"Время на авторизацию MaoPickMe истекло.");
        }, Math.max(15, getConfig().getInt("session-timeout-seconds",45))*20L);
        timeouts.put(p.getUniqueId(), timeout);
    }

    @EventHandler public void onQuit(PlayerQuitEvent e) {
        UUID id=e.getPlayer().getUniqueId(); authenticated.remove(id); prompts.remove(id);
        BukkitTask t=timeouts.remove(id); if(t!=null)t.cancel(); attempts.remove(id);
    }

    private void openMenu(Player p) {
        Inventory inv=Bukkit.createInventory(null, 27, MENU_TITLE);
        inv.setItem(11, item(Material.LIME_DYE, ChatColor.GREEN+"Войти в MaoPickMe", "Нажми, чтобы ввести логин и пароль"));
        inv.setItem(13, item(Material.WRITABLE_BOOK, ChatColor.LIGHT_PURPLE+"Как создать аккаунт", "Зарегистрируйся на сайте MaoPickMe", "hm572194.webhm.cloud"));
        inv.setItem(15, item(Material.BOOK, ChatColor.AQUA+"Помощь", "Используй аккаунт сайта MaoPickMe"));
        inv.setItem(22, item(Material.BARRIER, ChatColor.RED+"Выход", "Отключиться от сервера"));
        p.openInventory(inv);
    }

    private ItemStack item(Material type, String name, String... lore) {
        ItemStack stack=new ItemStack(type); ItemMeta meta=stack.getItemMeta();
        meta.setDisplayName(name); meta.setLore(Arrays.asList(lore)); stack.setItemMeta(meta); return stack;
    }

    @EventHandler public void onMenuClick(InventoryClickEvent e) {
        if (!(e.getWhoClicked() instanceof Player p)) return;
        if (locked(p)) e.setCancelled(true);
        if (!MENU_TITLE.equals(e.getView().getTitle())) return;
        e.setCancelled(true);
        if (e.getRawSlot()==11) {
            p.closeInventory(); prompts.put(p.getUniqueId(),new Prompt(Step.IDENTITY,null));
            p.sendMessage(ChatColor.LIGHT_PURPLE+"MaoPickMe "+ChatColor.GRAY+"| Введи логин или email в чат. Сообщение не будет опубликовано.");
        } else if(e.getRawSlot()==22) p.kickPlayer(ChatColor.RED+"Для входа требуется авторизация MaoPickMe.");
        else if(e.getRawSlot()==13 || e.getRawSlot()==15) {
            p.sendMessage(ChatColor.AQUA+"Регистрация и подтверждение почты: https://hm572194.webhm.cloud/account/register.html");
            p.sendMessage(ChatColor.GRAY+"После регистрации вернись и нажми «Войти».");
        }
    }
    @EventHandler public void onDrag(InventoryDragEvent e) {
        if (e.getWhoClicked() instanceof Player p && locked(p)) e.setCancelled(true);
        if(MENU_TITLE.equals(e.getView().getTitle())) e.setCancelled(true);
    }
    @EventHandler public void onFlight(PlayerToggleFlightEvent e){if(locked(e.getPlayer()))e.setCancelled(true);}
    @EventHandler public void onHeld(PlayerItemHeldEvent e){if(locked(e.getPlayer()))e.setCancelled(true);}

    @EventHandler public void onChat(AsyncPlayerChatEvent e) {
        Player p=e.getPlayer(); if(authenticated.contains(p.getUniqueId())) return;
        e.setCancelled(true);
        Prompt prompt=prompts.get(p.getUniqueId());
        if(prompt==null) { Bukkit.getScheduler().runTask(this,()->openMenu(p)); return; }
        String input=e.getMessage();
        if(input.length()>254 || input.isBlank()) { p.sendMessage(ChatColor.RED+"Некорректный ввод. Попробуй ещё раз."); return; }
        if(prompt.step==Step.IDENTITY) {
            prompts.put(p.getUniqueId(),new Prompt(Step.PASSWORD,input));
            p.sendMessage(ChatColor.LIGHT_PURPLE+"Теперь введи пароль MaoPickMe. Он скрыт и не появится в чате.");
        } else {
            prompts.remove(p.getUniqueId());
            authenticate(p,prompt.identity,input);
        }
    }

    private void authenticate(Player p,String identity,String password) {
        int count=attempts.merge(p.getUniqueId(),1,Integer::sum);
        int max=getConfig().getInt("max-login-attempts",5);
        if(count>max) { p.kickPlayer(ChatColor.RED+"Слишком много попыток входа."); return; }
        p.sendMessage(ChatColor.GRAY+"Проверяем аккаунт MaoPickMe…");
        Bukkit.getScheduler().runTaskAsynchronously(this,()->{
            boolean ok=false; String reason="Не удалось связаться с сервером авторизации.";
            try {
                JsonObject body=new JsonObject(); body.addProperty("identity",identity); body.addProperty("password",password);
                body.addProperty("uuid",p.getUniqueId().toString()); body.addProperty("minecraft_name",p.getName());
                HttpRequest request=HttpRequest.newBuilder(URI.create(getConfig().getString("api-url")))
                    .timeout(Duration.ofSeconds(12)).header("Content-Type","application/json")
                    .header("X-Mao-Server-Key",getConfig().getString("server-secret"))
                    .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body))).build();
                HttpResponse<String> response=http.send(request,HttpResponse.BodyHandlers.ofString());
                JsonObject result=gson.fromJson(response.body(),JsonObject.class);
                if(response.statusCode()==200 && result!=null && result.has("token")) {
                    ok=verifyToken(result.get("token").getAsString(),p.getUniqueId());
                    if(!ok) reason="Сервер вернул недействительный токен.";
                } else if(result!=null && result.has("error")) {
                    String err=result.get("error").getAsString();
                    reason=switch(err) {
                        case "email_not_verified" -> "Сначала подтверди email на сайте MaoPickMe.";
                        case "invalid_credentials" -> "Неверный логин или пароль.";
                        case "server_not_configured" -> "Серверная авторизация ещё не настроена.";
                        default -> "Ошибка авторизации: "+err;
                    };
                }
            } catch(Exception ex) { getLogger().warning("Game login request failed: "+ex.getClass().getSimpleName()); }
            final boolean success=ok; final String message=reason;
            Bukkit.getScheduler().runTask(this,()->{
                if(!p.isOnline()) return;
                if(success) {
                    authenticated.add(p.getUniqueId()); attempts.remove(p.getUniqueId());
                    p.setWalkSpeed(0.2f); p.setFlySpeed(0.1f); p.closeInventory();
                    p.sendTitle(ChatColor.LIGHT_PURPLE+"MaoPickMe",ChatColor.GREEN+"Авторизация успешна",10,50,15);
                    p.sendMessage(ChatColor.GREEN+"Ты вошёл в аккаунт MaoPickMe. Приятной игры!");
                    BukkitTask t=timeouts.remove(p.getUniqueId()); if(t!=null)t.cancel();
                } else {
                    p.sendMessage(ChatColor.RED+message);
                    if(attempts.getOrDefault(p.getUniqueId(),0)>=max) p.kickPlayer(ChatColor.RED+"Лимит попыток входа исчерпан.");
                    else openMenu(p);
                }
            });
        });
    }

    private boolean verifyToken(String token,UUID expectedUuid) {
        try {
            String[] parts=token.split("\\.",2); if(parts.length!=2)return false;
            String secret=getConfig().getString("server-secret","");
            if(secret.length()<32 || secret.equals("CHANGE_ME_TO_A_LONG_RANDOM_SECRET"))return false;
            Mac mac=Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
            byte[] sig=mac.doFinal(parts[0].getBytes(StandardCharsets.US_ASCII));
            String expected=Base64.getUrlEncoder().withoutPadding().encodeToString(sig);
            if(!java.security.MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),parts[1].getBytes(StandardCharsets.US_ASCII)))return false;
            String json=new String(Base64.getUrlDecoder().decode(parts[0]),StandardCharsets.UTF_8);
            JsonObject payload=gson.fromJson(json,JsonObject.class);
            return expectedUuid.toString().equals(payload.get("uuid").getAsString()) && payload.get("exp").getAsLong()>System.currentTimeMillis()/1000;
        } catch(Exception ex) { return false; }
    }

    private boolean locked(Player p){return !authenticated.contains(p.getUniqueId());}
    @EventHandler public void onMove(PlayerMoveEvent e){if(locked(e.getPlayer()) && e.getTo()!=null && (e.getFrom().getBlockX()!=e.getTo().getBlockX()||e.getFrom().getBlockY()!=e.getTo().getBlockY()||e.getFrom().getBlockZ()!=e.getTo().getBlockZ()))e.setTo(e.getFrom());}
    @EventHandler public void onCommand(PlayerCommandPreprocessEvent e){if(locked(e.getPlayer()) && !e.getMessage().toLowerCase(Locale.ROOT).startsWith("/maoauth")){e.setCancelled(true);e.getPlayer().sendMessage(ChatColor.RED+"Сначала войди через меню MaoAuth.");}}
    @EventHandler public void onInteract(PlayerInteractEvent e){if(locked(e.getPlayer()))e.setCancelled(true);}
    @EventHandler public void onBreak(BlockBreakEvent e){if(locked(e.getPlayer()))e.setCancelled(true);}
    @EventHandler public void onPlace(BlockPlaceEvent e){if(locked(e.getPlayer()))e.setCancelled(true);}
    @EventHandler public void onDamage(EntityDamageEvent e){if(e.getEntity() instanceof Player p && locked(p))e.setCancelled(true);}
    @EventHandler public void onPickup(EntityPickupItemEvent e){if(e.getEntity() instanceof Player p && locked(p))e.setCancelled(true);}
    @EventHandler public void onDrop(PlayerDropItemEvent e){if(locked(e.getPlayer()))e.setCancelled(true);}
    @EventHandler public void onSwap(PlayerSwapHandItemsEvent e){if(locked(e.getPlayer()))e.setCancelled(true);}
    @EventHandler public void onConsume(org.bukkit.event.player.PlayerItemConsumeEvent e){if(locked(e.getPlayer()))e.setCancelled(true);}

    private enum Step { IDENTITY, PASSWORD }
    private record Prompt(Step step,String identity) {}
}
