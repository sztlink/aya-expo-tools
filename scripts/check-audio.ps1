$code = @'
using System;
using System.Runtime.InteropServices;

[ComImport][Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
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
    int NotImpl1(); int NotImpl2();
    [PreserveSig] int SetMasterVolumeLevelScalar(float level, Guid ctx);
    int NotImpl3();
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
    int NotImpl4(); int NotImpl5(); int NotImpl6(); int NotImpl7();
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
    public static float Get() { float l; GetVol().GetMasterVolumeLevelScalar(out l); return l * 100; }
    public static bool IsMuted() { bool m; GetVol().GetMute(out m); return m; }
}
'@
Add-Type -TypeDefinition $code -ErrorAction Stop
Write-Output "Volume: $([int][Math]::Round([AudioCtrl]::Get()))%"
Write-Output "Muted: $([AudioCtrl]::IsMuted())"
