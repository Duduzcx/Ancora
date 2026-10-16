package com.zcx.ancora.wear;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.Button;
import android.widget.TextView;

/** Pequenos ajudantes de interface (cores e botões no estilo da Nórica). */
final class Ui {
    static final int BG = Color.parseColor("#021013");
    static final int EMERALD = Color.parseColor("#34D399");
    static final int ROSE = Color.parseColor("#F43F5E");
    static final int TEXT_DIM = Color.parseColor("#99FFFFFF");

    private Ui() {}

    static int dp(Context c, int v) {
        return Math.round(v * c.getResources().getDisplayMetrics().density);
    }

    static TextView text(Context c, String s, int sp, int color, boolean bold) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    static Button button(Context c, String s, int bg, int fg) {
        Button b = new Button(c);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(15);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(fg);
        GradientDrawable d = new GradientDrawable();
        d.setColor(bg);
        d.setCornerRadius(dp(c, 24));
        b.setBackground(d);
        b.setMinHeight(dp(c, 48));
        return b;
    }
}
