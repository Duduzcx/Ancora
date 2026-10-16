package com.zcx.ancora;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Widget "Como está o seu mar?" na tela inicial do celular.
 * Cada botão abre o app com um link com.zcx.norica://humor/<humor>; o app registra
 * o humor e mostra a confirmação (S.O.S abre direto a tela de resgate).
 */
public class MoodWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mood);
            views.setOnClickPendingIntent(R.id.widget_title, link(context, "com.zcx.norica://humor/abrir", 10));
            views.setOnClickPendingIntent(R.id.widget_calmo, link(context, "com.zcx.norica://humor/calmo", 11));
            views.setOnClickPendingIntent(R.id.widget_ansioso, link(context, "com.zcx.norica://humor/ansioso", 12));
            views.setOnClickPendingIntent(R.id.widget_agitado, link(context, "com.zcx.norica://humor/agitado", 13));
            views.setOnClickPendingIntent(R.id.widget_sos, link(context, "com.zcx.norica://humor/sos", 14));
            manager.updateAppWidget(appWidgetId, views);
        }
    }

    private static PendingIntent link(Context context, String uri, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
