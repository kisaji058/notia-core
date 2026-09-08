package com.kisajistudio.notia;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(name = "NotiaPush")
public class NotiaPushPlugin extends Plugin {

    @PluginMethod
    public void getDeviceToken(PluginCall call) {

        FirebaseMessaging
            .getInstance()
            .getToken()
            .addOnCompleteListener(task -> {

                if (!task.isSuccessful()) {
                    call.reject(
                        "FCM token acquisition failed",
                        task.getException()
                    );
                    return;
                }

                String token = task.getResult();

                if (
                    token == null ||
                    token.isEmpty()
                ) {
                    call.reject(
                        "FCM token is empty"
                    );
                    return;
                }

                JSObject result =
                    new JSObject();

                result.put(
                    "deviceToken",
                    token
                );

                result.put(
                    "environment",
                    "production"
                );

                result.put(
                    "platform",
                    "android"
                );

                call.resolve(result);
            });
    }

    @PluginMethod
    public void getPendingRoute(
        PluginCall call
    ) {

        JSObject result =
            new JSObject();

        result.put(
            "route",
            JSObject.NULL
        );

        call.resolve(result);
    }
}
