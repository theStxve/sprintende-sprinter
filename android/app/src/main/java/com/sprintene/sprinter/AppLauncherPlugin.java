package com.sprintene.sprinter;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Öffnet Obtainium, damit Updates dort installiert werden können.
 * Die Pakete stehen unter <queries> im Manifest – ohne das sieht die App sie ab Android 11 nicht.
 */
@CapacitorPlugin(name = "AppLauncher")
public class AppLauncherPlugin extends Plugin {

    /** Normale Ausgabe und F-Droid-Ausgabe von Obtainium */
    private static final String[] OBTAINIUM_PACKAGES = { "dev.imranr.obtainium", "dev.imranr.obtainium.fdroid" };

    @PluginMethod
    public void openObtainium(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        for (String pkg : OBTAINIUM_PACKAGES) {
            Intent launch = pm.getLaunchIntentForPackage(pkg);
            if (launch != null && start(launch)) {
                resolve(call, true);
                return;
            }
        }
        // Andere Ausgaben (z. B. selbst gebaut) melden sich über das Schema obtainium://
        String repo = call.getString("repo", "");
        Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse("obtainium://add/" + repo));
        resolve(call, view.resolveActivity(pm) != null && start(view));
    }

    private boolean start(Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException | SecurityException e) {
            return false;
        }
    }

    private void resolve(PluginCall call, boolean opened) {
        JSObject result = new JSObject();
        result.put("opened", opened);
        call.resolve(result);
    }
}
