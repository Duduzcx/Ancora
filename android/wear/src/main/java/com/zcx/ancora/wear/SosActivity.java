package com.zcx.ancora.wear;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * S.O.S no relógio: ligar para o CVV (188) ou SAMU (192) e um aterramento rápido.
 * Em relógios sem chip, o discador abre no celular pareado (ou mostramos o número).
 */
public class SosActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        int pad = Ui.dp(this, 22);
        col.setPadding(pad, Ui.dp(this, 28), pad, Ui.dp(this, 36));
        col.setBackgroundColor(Ui.BG);

        col.addView(Ui.text(this, "Você não está sozinho(a).", 15, 0xFFFFFFFF, true));
        col.addView(Ui.text(this, "Respire. Peça ajuda agora:", 12, Ui.TEXT_DIM, false));

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = Ui.dp(this, 10);

        Button cvv = Ui.button(this, "Ligar 188 · CVV", Ui.EMERALD, Ui.BG);
        cvv.setOnClickListener(v -> dial("188"));
        col.addView(cvv, lp);

        Button samu = Ui.button(this, "Ligar 192 · SAMU", Ui.ROSE, 0xFFFFFFFF);
        samu.setOnClickListener(v -> dial("192"));
        col.addView(samu, lp);

        Button breathe = Ui.button(this, "Respirar comigo", 0x22FFFFFF, 0xFFFFFFFF);
        breathe.setOnClickListener(v -> startActivity(new Intent(this, BreathActivity.class)));
        col.addView(breathe, lp);

        TextView ground = Ui.text(this,
                "Aterramento 5-4-3-2-1:\n5 coisas que você vê\n4 que pode tocar\n3 sons que ouve\n2 cheiros\n1 gosto",
                12, Ui.TEXT_DIM, false);
        LinearLayout.LayoutParams lg = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lg.topMargin = Ui.dp(this, 16);
        col.addView(ground, lg);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Ui.BG);
        scroll.addView(col);
        setContentView(scroll);
    }

    private void dial(String number) {
        try {
            startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + number)));
        } catch (Exception e) {
            Toast.makeText(this, "Ligue " + number + " pelo celular", Toast.LENGTH_LONG).show();
        }
    }
}
