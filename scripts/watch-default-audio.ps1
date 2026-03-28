$code = @'
using System;
using System.Runtime.InteropServices;
[ComImport][Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MMDeviceEnumerator {}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int NotImpl1(); [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { [PreserveSig] int Activate(ref Guid id, int clsCtx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object iface); [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id); }
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume { int NotImpl1(); int NotImpl2(); [PreserveSig] int SetMasterVolumeLevelScalar(float level, Guid ctx); int NotImpl3(); [PreserveSig] int GetMasterVolumeLevelScalar(out float level); int NotImpl4(); int NotImpl5(); int NotImpl6(); int NotImpl7(); [PreserveSig] int GetMute(out bool mute); [PreserveSig] int SetMute(bool mute, Guid ctx); }
public class AudioCtrl {
    public static string GetName() { var en=(IMMDeviceEnumerator)new MMDeviceEnumerator(); IMMDevice dev; en.GetDefaultAudioEndpoint(0,1,out dev); string id; dev.GetId(out id); return id; }
    public static float GetVol() { var en=(IMMDeviceEnumerator)new MMDeviceEnumerator(); IMMDevice dev; en.GetDefaultAudioEndpoint(0,1,out dev); var iid=typeof(IAudioEndpointVolume).GUID; object o; dev.Activate(ref iid,23,IntPtr.Zero,out o); float l; ((IAudioEndpointVolume)o).GetMasterVolumeLevelScalar(out l); return l; }
}
'@
Add-Type -TypeDefinition $code -ErrorAction Stop
$sw=[System.Diagnostics.Stopwatch]::StartNew()
for ($i=0; $i -lt 20; $i++) {
  $name=[AudioCtrl]::GetName()
  $vol=[AudioCtrl]::GetVol()
  Write-Output "$(Get-Date -Format 'HH:mm:ss.fff') $($sw.ElapsedMilliseconds)ms vol=$([math]::Round($vol,4)) id=$name"
  Start-Sleep -Milliseconds 200
}
