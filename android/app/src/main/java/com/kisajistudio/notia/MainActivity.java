package com.kisajistudio.notia;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(
            NotiaPlayBillingPlugin.class
        );

        super.onCreate(savedInstanceState);
    }
}
