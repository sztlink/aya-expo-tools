param([string]$Action, [int]$Level = 0)

$code = @'
using System;
using System.Runtime.InteropServices;

[ComImport]
[Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumerator {}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int NotImpl1();
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    [PreserveSig] int Activate(ref Guid id, int clsCtx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
}

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int NotImpl1();
    int NotImpl2();
    int NotImpl3();
    [PreserveSig] int SetMasterVolumeLevel(float levelDB, Guid ctx);
    [PreserveSig] int SetMasterVolumeLevelScalar(float level, Guid ctx);
    [PreserveSig] int GetMasterVolumeLevel(out float levelDB);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
    int NotImpl4();
    int NotImpl5();
    int NotImpl6();
    int NotImpl7();
    int NotImpl8();
    int NotImpl9();
    [PreserveSig] int GetMute(out bool mute);
    [PreserveSig] int SetMute(bool mute, Guid ctx);
}

public class AudioCtrl {
    static IAudioEndpointVolume GetVol() {
        var en = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice dev; en.GetDefaultAudioEndpoint(0, 1, out dev);
        var iid = typeof(IAudioEndpointVolume).GUID;
        object o; dev.Activate(ref iid, 23, IntPtr.Zero, out o);
        return (IAudioEndpointVolume)o;
    }

    // Range: -96dB (silent) to 0dB (max). Step: 1.5dB.
    // 0%=-96dB, 50%=-10dB, 80%=-3dB, 100%=0dB
    static float PercentToDB(float pct) {
        if (pct <= 0) return -96.0f;
        if (pct >= 100) return 0.0f;
        // Use logarithmic scale: dB = 20 * log10(pct/100)
        return (float)(20.0 * Math.Log10(pct / 100.0));
    }

    static float DBToPercent(float db) {
        if (db <= -96.0f) return 0.0f;
        if (db >= 0.0f) return 100.0f;
        return (float)(Math.Pow(10.0, db / 20.0) * 100.0);
    }

    public static float Get() {
        float db; GetVol().GetMasterVolumeLevel(out db);
        return DBToPercent(db);
    }

    public static void Set(float pct) {
        float db = PercentToDB(Math.Max(0, Math.Min(100, pct)));
        GetVol().SetMasterVolumeLevel(db, Guid.Empty);
    }
}
'@

Add-Type -TypeDefinition $code -ErrorAction Stop

if ($Action -eq "get") {
    $v = [AudioCtrl]::Get()
    Write-Output ([int][Math]::Round($v))
} elseif ($Action -eq "set") {
    [AudioCtrl]::Set($Level)
    # Read back actual level
    $v = [AudioCtrl]::Get()
    Write-Output ([int][Math]::Round($v))
} else {
    Write-Output "error:unknown_action"
}
