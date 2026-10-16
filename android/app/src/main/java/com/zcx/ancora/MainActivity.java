package com.zcx.ancora;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin próprio (abrir as configurações de notificação do app)
        registerPlugin(NoricaNotify.class);
        super.onCreate(savedInstanceState);
    }
}
