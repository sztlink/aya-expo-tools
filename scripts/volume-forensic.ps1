Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport][Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MMDeviceEnumerator {}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int NotImpl1(); [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { [PreserveSig] int Activate(ref Guid id, int clsCtx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object iface); }
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
    static IAudioEndpointVolume _vol;
    static AudioCtrl() {
        var en = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice dev; en.GetDefaultAudioEndpoint(0, 1, out dev);
        var iid = typeof(IAudioEndpointVolume).GUID;
        object o; dev.Activate(ref iid, 23, IntPtr.Zero, out o);
        _vol = (IAudioEndpointVolume)o;
    }
    public static float Get() { float l; _vol.GetMasterVolumeLevelScalar(out l); return l; }
    public static void Set(float level) { _vol.SetMasterVolumeLevelScalar(level, Guid.Empty); }
    public static bool GetMute() { bool m; _vol.GetMute(out m); return m; }
}
'@ -ErrorAction Stop

# Record exact float values at high speed
[AudioCtrl]::Set(0.8)
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$readings = @()
for ($i = 0; $i -lt 100; $i++) {
    $v = [AudioCtrl]::Get()
    $m = [AudioCtrl]::GetMute()
    $readings += "$($sw.ElapsedMilliseconds)ms vol=$([math]::Round($v, 4)) mute=$m"
    if ($v -lt 0.1 -and $i -gt 2) {
        $readings += "$($sw.ElapsedMilliseconds)ms *** ZEROED ***"
        # Continue recording a few more
        for ($j = 0; $j -lt 5; $j++) {
            Start-Sleep -Milliseconds 20
            $v2 = [AudioCtrl]::Get()
            $readings += "$($sw.ElapsedMilliseconds)ms vol=$([math]::Round($v2, 4))"
        }
        break
    }
    Start-Sleep -Milliseconds 50
}
$readings | ForEach-Object { Write-Output $_ }
