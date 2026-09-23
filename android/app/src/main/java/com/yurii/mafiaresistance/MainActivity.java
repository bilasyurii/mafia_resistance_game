package com.yurii.mafiaresistance;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Capacitor keeps the WebView running in the background by default, which
    // let timer beeps keep playing after leaving the app. Freeze it instead.
    @Override
    public void onPause() {
        super.onPause();
        if (getBridge() != null) {
            WebView webView = getBridge().getWebView();
            webView.onPause();
            webView.pauseTimers();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() != null) {
            WebView webView = getBridge().getWebView();
            webView.onResume();
            webView.resumeTimers();
        }
    }
}
