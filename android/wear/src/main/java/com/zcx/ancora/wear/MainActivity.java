package com.zcx.ancora.wear;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.LinearLayout;
import android.widget.ScrollView;

/** Tela inicial do relógio: Respirar ou S.O.S. */
public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        int pad = Ui.dp(this, 22);
        col.setPadding(pad, Ui.dp(this, 28), pad, Ui.dp(this, 28));
        col.setBackgroundColor(Ui.BG);

        col.addView(Ui.text(this, "Nórica", 18, Ui.EMERALD, true));
        col.addView(Ui.text(this, "Seu porto seguro no pulso", 12, Ui.TEXT_DIM, false));

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = Ui.dp(this, 10);

        android.widget.Button breathe = Ui.button(this, "Respirar 4-7-8", Ui.EMERALD, Ui.BG);
        breathe.setOnClickListener(v -> startActivity(new Intent(this, BreathActivity.class)));
        col.addView(breathe, lp);

        android.widget.Button sos = Ui.button(this, "S.O.S", Ui.ROSE, 0xFFFFFFFF);
        sos.setOnClickListener(v -> startActivity(new Intent(this, SosActivity.class)));
        col.addView(sos, lp);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Ui.BG);
        scroll.addView(col);
        setContentView(scroll);
    }
}
