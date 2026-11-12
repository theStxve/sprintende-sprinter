package com.sprintene.sprinter;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget „Nächster Weg“: zeigt den nächsten gespeicherten Weg mit „spätestens los“ und einem Knopf,
 * der den Pacer direkt startet. Die Einträge kommen aus der App (WidgetPlugin); das Widget schaltet
 * per Wecker selbst auf den nächsten Eintrag weiter, auch wenn die App geschlossen ist.
 */
public class NextTripWidget extends AppWidgetProvider {

    static final String PREFS = "sprinter_widget";
    static final String KEY_ENTRIES = "entries";
    private static final String ACTION_REFRESH = "com.sprintene.sprinter.WIDGET_REFRESH";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) render(context);
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(refreshIntent(context));
    }

    static void render(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, NextTripWidget.class));
        if (ids.length == 0) return;

        long now = System.currentTimeMillis();
        JSONObject next = nextEntry(context, now);
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_next_trip);

        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, flags()));
        }

        long wakeAt = 0;
        if (next == null) {
            v.setTextViewText(R.id.widget_title, "Sprintende Sprinter");
            v.setTextViewText(R.id.widget_main, "Kein Weg geplant");
            v.setTextViewText(R.id.widget_detail, "Lege in der App einen Weg mit Uhrzeit an");
            v.setTextColor(R.id.widget_main, context.getColor(R.color.widget_ink));
            v.setViewVisibility(R.id.widget_go, View.GONE);
        } else {
            long arrive = next.optLong("arriveMs");
            long leave = next.optLong("leaveMs");
            boolean late = leave > 0 && now >= leave;
            String main = leave > 0 ? (late ? "Jetzt los!" : "Los um " + clock(leave)) : "Da sein " + clock(arrive);
            String detail = next.optString("detail");
            if (leave > 0) detail += " · da " + clock(arrive);

            v.setTextViewText(R.id.widget_title, next.optString("title"));
            v.setTextViewText(R.id.widget_main, main);
            v.setTextViewText(R.id.widget_detail, detail);
            boolean warn = late || next.optBoolean("warn");
            v.setTextColor(R.id.widget_main, context.getColor(warn ? R.color.widget_warn : R.color.widget_ink));

            Uri uri = new Uri.Builder()
                .scheme("sprintende")
                .authority("start")
                .appendQueryParameter("preset", next.optString("presetId"))
                .appendQueryParameter("scheduled", String.valueOf(next.optLong("scheduledMs")))
                .build();
            Intent go = new Intent(Intent.ACTION_VIEW, uri, context, MainActivity.class);
            go.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            v.setOnClickPendingIntent(R.id.widget_go, PendingIntent.getActivity(context, 1, go, flags()));
            v.setViewVisibility(R.id.widget_go, View.VISIBLE);

            // Weiterschalten: bei „spätestens los“ (→ „Jetzt los!“) und wenn der Eintrag vorbei ist
            wakeAt = leave > now ? leave : arrive;
        }
        manager.updateAppWidget(ids, v);
        schedule(context, wakeAt);
    }

    /** Erster Eintrag, der noch nicht vorbei ist (die App liefert sie sortiert) */
    private static JSONObject nextEntry(Context context, long now) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ENTRIES, "[]");
        try {
            JSONArray list = new JSONArray(raw);
            for (int i = 0; i < list.length(); i++) {
                JSONObject e = list.getJSONObject(i);
                if (e.optLong("arriveMs") > now) return e;
            }
        } catch (JSONException ignored) {
            // kaputte Daten: wie „nichts geplant“
        }
        return null;
    }

    private static void schedule(Context context, long at) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = refreshIntent(context);
        am.cancel(pi);
        if (at <= 0) return;
        long when = at + 1000;
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC, when, pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC, when, pi);
            }
        } catch (SecurityException e) {
            am.set(AlarmManager.RTC, when, pi);
        }
    }

    private static PendingIntent refreshIntent(Context context) {
        Intent i = new Intent(context, NextTripWidget.class).setAction(ACTION_REFRESH);
        return PendingIntent.getBroadcast(context, 2, i, flags());
    }

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    private static String clock(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.GERMANY).format(new Date(ms));
    }
}
