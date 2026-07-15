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
    int RegisterControlChangeNotify(IntPtr pNotify);
    int UnregisterControlChangeNotify(IntPtr pNotify);
    [PreserveSig] int GetChannelCount(out uint channelCount);
    [PreserveSig] int SetMasterVolumeLevel(float levelDB, Guid ctx);
    [PreserveSig] int SetMasterVolumeLevelScalar(float level, Guid ctx);
    [PreserveSig] int GetMasterVolumeLevel(out float levelDB);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
    [PreserveSig] int SetChannelVolumeLevel(uint channelNumber, float levelDB, Guid ctx);
    [PreserveSig] int SetChannelVolumeLevelScalar(uint channelNumber, float level, Guid ctx);
    [PreserveSig] int GetChannelVolumeLevel(uint channelNumber, out float levelDB);
    [PreserveSig] int GetChannelVolumeLevelScalar(uint channelNumber, out float level);
    [PreserveSig] int SetMute(bool mute, Guid ctx);
    [PreserveSig] int GetMute(out bool mute);
    [PreserveSig] int GetVolumeStepInfo(out uint step, out uint stepCount);
    [PreserveSig] int VolumeStepUp(Guid ctx);
    [PreserveSig] int VolumeStepDown(Guid ctx);
    [PreserveSig] int QueryHardwareSupport(out uint mask);
    [PreserveSig] int GetVolumeRange(out float minDB, out float maxDB, out float incrementDB);
}

public static class AudioCtrl {
    const int CLSCTX_ALL = 23;

    static void Check(int hr, string op) {
        if (hr != 0) Marshal.ThrowExceptionForHR(hr);
    }

    static IAudioEndpointVolume GetVol() {
        var en = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice dev;
        Check(en.GetDefaultAudioEndpoint(0, 1, out dev), "GetDefaultAudioEndpoint");
        var iid = typeof(IAudioEndpointVolume).GUID;
        object o;
        Check(dev.Activate(ref iid, CLSCTX_ALL, IntPtr.Zero, out o), "Activate");
        return (IAudioEndpointVolume)o;
    }

    public static int Get() {
        var vol = GetVol();
        bool mute;
        float scalar;
        Check(vol.GetMute(out mute), "GetMute");
        Check(vol.GetMasterVolumeLevelScalar(out scalar), "GetMasterVolumeLevelScalar");
        var pct = (int)Math.Round(Math.Max(0.0f, Math.Min(1.0f, scalar)) * 100.0f);
        return mute ? 0 : pct;
    }

    public static int Set(int pct) {
        var vol = GetVol();
        var clamped = Math.Max(0, Math.Min(100, pct));

        if (clamped <= 0) {
            Check(vol.SetMute(true, Guid.Empty), "SetMute(true)");
            Check(vol.SetMasterVolumeLevelScalar(0.0f, Guid.Empty), "SetMasterVolumeLevelScalar(0)");
            return 0;
        }

        Check(vol.SetMute(false, Guid.Empty), "SetMute(false)");
        Check(vol.SetMasterVolumeLevelScalar(clamped / 100.0f, Guid.Empty), "SetMasterVolumeLevelScalar");
        return Get();
    }
}
'@

try {
    Add-Type -TypeDefinition $code -ErrorAction Stop

    if ($Action -eq "get") {
        $v = [AudioCtrl]::Get()
        Write-Output ([int][Math]::Round($v))
    } elseif ($Action -eq "set") {
        $v = [AudioCtrl]::Set($Level)
        Write-Output ([int][Math]::Round($v))
    } else {
        Write-Output "error:unknown_action"
        exit 1
    }
} catch {
    Write-Output ("error:" + $_.Exception.Message)
    exit 1
}
