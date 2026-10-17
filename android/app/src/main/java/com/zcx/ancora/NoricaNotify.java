package com.zcx.ancora;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Atalhos de notificação da Nórica:
 * - status(): se as notificações do app estão ligadas no Android.
 * - firebase(): se o app foi montado com o google-services.json (push do Firebase).
 *   Sem ele, pedir o token do Firebase fecharia o app; então o JS só registra quando isto der true.
 * - openSettings(): abre direto a tela "Notificações" do app nas Configurações,
 *   para a pessoa ligar com um toque quando o Android não mostra mais a janela de permissão.
 */
@CapacitorPlugin(name = "NoricaNotify")
public class NoricaNotify extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        ret.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    @PluginMethod
    public void firebase(PluginCall call) {
        JSObject ret = new JSObject();
        int id = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        ret.put("ready", id != 0);
        call.resolve(ret);
    }

    /** Atualiza o widget "Foguinho" na tela inicial. */
    @PluginMethod
    public void setFlameWidget(PluginCall call) {
        FlameWidget.save(
            getContext(),
            call.getString("count", "0"),
            call.getString("title", ""),
            call.getString("sub", ""),
            Boolean.TRUE.equals(call.getBoolean("lit", false))
        );
        call.resolve();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível abrir as configurações", e);
        }
    }
}
