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
