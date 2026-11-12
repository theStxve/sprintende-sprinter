package com.sprintene.sprinter;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Nimmt die nächsten Abfahrten aus der App entgegen und zeichnet das Widget neu. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String entries = call.getString("entries", "[]");
        getContext()
            .getSharedPreferences(NextTripWidget.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(NextTripWidget.KEY_ENTRIES, entries)
            .apply();
        NextTripWidget.render(getContext());
        call.resolve();
    }
}
