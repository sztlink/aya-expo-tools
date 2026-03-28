Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport][Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MMDeviceEnumerator {}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int NotImpl1();
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
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
public class ACtrl {
    public static int SetAndCheck() {
        var en = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice dev; en.GetDefaultAudioEndpoint(0, 1, out dev);
        var iid = typeof(IAudioEndpointVolume).GUID;
        object o; dev.Activate(ref iid, 23, IntPtr.Zero, out o);
        var vol = (IAudioEndpointVolume)o;
        
        // Set to 80%
        int hr = vol.SetMasterVolumeLevelScalar(0.8f, Guid.Empty);
        Console.WriteLine("SetVolume HR=" + hr);
        
        // Read back immediately
        float level; vol.GetMasterVolumeLevelScalar(out level);
        Console.WriteLine("ReadBack vol=" + Math.Round(level*100) + "%");
        
        // Read 10 more times quickly
        for (int i = 0; i < 10; i++) {
            System.Threading.Thread.Sleep(50);
            vol.GetMasterVolumeLevelScalar(out level);
            Console.WriteLine("  +" + ((i+1)*50) + "ms vol=" + Math.Round(level*100) + "%");
            if (level < 0.1f) { Console.WriteLine("  *** ZEROED ***"); break; }
        }
        return 0;
    }
}
'@ -ErrorAction Stop
[ACtrl]::SetAndCheck()
