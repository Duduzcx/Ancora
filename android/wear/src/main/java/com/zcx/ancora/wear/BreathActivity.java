package com.zcx.ancora.wear;

import android.app.Activity;
import android.content.Context;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * Respiração 4-7-8 no relógio. Uma vibração curta marca cada troca de fase,
 * então dá para fazer de olhos fechados.
 */
public class BreathActivity extends Activity {
    private static final String[] NAMES = {"Inspira", "Segura", "Solta"};
    private static final int[] SECONDS = {4, 7, 8};

    private final Handler handler = new Handler(Looper.getMainLooper());
    private View circle;
    private TextView label;
    private TextView count;
    private int phase = 0;
    private int left = 0;
    private int cycles = 0;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Ui.BG);

        circle = new View(this);
        GradientDrawable d = new GradientDrawable();
        d.setShape(GradientDrawable.OVAL);
        d.setColor(0x3334D399);
        d.setStroke(Ui.dp(this, 2), 0x8834D399);
        circle.setBackground(d);
        int size = Ui.dp(this, 110);
        root.addView(circle, new FrameLayout.LayoutParams(size, size, Gravity.CENTER));

        label = Ui.text(this, "", 16, Ui.EMERALD, true);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        lp.topMargin = -Ui.dp(this, 14);
        root.addView(label, lp);

        count = Ui.text(this, "", 26, 0xFFFFFFFF, true);
        FrameLayout.LayoutParams lp2 = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        lp2.topMargin = Ui.dp(this, 18);
        root.addView(count, lp2);

        root.setOnClickListener(v -> finish());
        setContentView(root);
        startPhase(0);
    }

    private void startPhase(int p) {
        phase = p;
        left = SECONDS[p];
        label.setText(NAMES[p]);
        count.setText(String.valueOf(left));
        vibrate(p == 0 ? 120 : 60);
        float target = p == 2 ? 0.7f : 1.25f;
        circle.animate().scaleX(target).scaleY(target).setDuration(SECONDS[p] * 1000L)
                .setInterpolator(new AccelerateDecelerateInterpolator()).start();
        handler.postDelayed(this::tick, 1000);
    }

    private void tick() {
        left--;
        if (left <= 0) {
            if (phase == 2) {
                cycles++;
                if (cycles >= 4) { // 4 ciclos ≈ 1 minuto e pouco
                    label.setText("Muito bem");
                    count.setText("💚");
                    vibrate(250);
                    handler.postDelayed(this::finish, 2500);
                    return;
                }
            }
            startPhase((phase + 1) % 3);
            return;
        }
        count.setText(String.valueOf(left));
        handler.postDelayed(this::tick, 1000);
    }

    private void vibrate(long ms) {
        try {
            Vibrator v;
            if (Build.VERSION.SDK_INT >= 31) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                v = vm.getDefaultVibrator();
            } else {
                v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (v != null) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
