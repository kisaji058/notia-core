package com.kisajistudio.notia;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ImageView;

public class SplashActivity extends Activity {

    private static final long SPLASH_DURATION_MS =
        800;

    @Override
    protected void onCreate(
        Bundle savedInstanceState
    ) {
        super.onCreate(
            savedInstanceState
        );

        requestWindowFeature(
            Window.FEATURE_NO_TITLE
        );

        getWindow().setFlags(
            WindowManager.LayoutParams
                .FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams
                .FLAG_LAYOUT_NO_LIMITS
        );

        ImageView imageView =
            new ImageView(this);

        imageView.setImageResource(
            R.drawable.splash
        );

        imageView.setScaleType(
            ImageView.ScaleType.CENTER_CROP
        );

        setContentView(
            imageView
        );

        new Handler(
            Looper.getMainLooper()
        ).postDelayed(
            () -> {
                Intent intent =
                    new Intent(
                        SplashActivity.this,
                        MainActivity.class
                    );

                startActivity(intent);

                finish();

                overridePendingTransition(
                    0,
                    0
                );
            },
            SPLASH_DURATION_MS
        );
    }
}
