package com.zcx.ancora;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Widget "Foguinho": mostra a chama com o amigo (ou o grupo) na tela inicial.
 * O app guarda o texto em SharedPreferences (via NoricaNotify.setFlameWidget) e pede
 * para o widget se redesenhar. Um toque abre a tela de amigos.
 */
public class FlameWidget extends AppWidgetProvider {

    static final String PREFS = "norica_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String count = p.getString("flame_count", "0");
        String title = p.getString("flame_title", context.getString(R.string.flame_widget_empty));
        String sub = p.getString("flame_sub", context.getString(R.string.flame_widget_hint));
        boolean lit = p.getBoolean("flame_lit", false);
        for (int id : appWidgetIds) {
            RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_flame);
            v.setTextViewText(R.id.flame_count, count);
            v.setTextViewText(R.id.flame_title, title);
            v.setTextViewText(R.id.flame_sub, sub);
            v.setInt(R.id.flame_badge, "setBackgroundResource", lit ? R.drawable.widget_flame_on : R.drawable.widget_flame_off);
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.zcx.norica://amigos/abrir"), context, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            v.setOnClickPendingIntent(R.id.flame_root, PendingIntent.getActivity(context, 31, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            manager.updateAppWidget(id, v);
        }
    }

    /** Chamado pelo app quando a chama muda. */
    static void save(Context context, String count, String title, String sub, boolean lit) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("flame_count", count)
            .putString("flame_title", title)
            .putString("flame_sub", sub)
            .putBoolean("flame_lit", lit)
            .apply();
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, FlameWidget.class));
        if (ids.length > 0) new FlameWidget().onUpdate(context, m, ids);
    }
}
