package com.simonpetersson.mrbludo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Reports whether this is a debug (developer) build, so admin statistics can skip it. */
@CapacitorPlugin(name = "BuildChannel")
public class BuildChannelPlugin extends Plugin {
    @PluginMethod
    public void get(PluginCall call) {
        JSObject r = new JSObject();
        r.put("channel", BuildConfig.DEBUG ? "test" : "store");
        call.resolve(r);
    }
}
