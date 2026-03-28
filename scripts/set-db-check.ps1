Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport][Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MMDeviceEnumerator {}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int X1(); [PreserveSig] int GetDefaultAudioEndpoint(int d, int r, out IMMDevice e); }
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { [PreserveSig] int Activate(ref Guid id, int c, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int X1(); int X2(); int X3();
    [PreserveSig] int SetMasterVolumeLevel(float levelDB, Guid g);
    [PreserveSig] int SetMasterVolumeLevelScalar(float l, Guid g);
    [PreserveSig] int GetMasterVolumeLevel(out float levelDB);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float l);
}
public class V {
    public static void Run() {
        var en=(IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice dev; en.GetDefaultAudioEndpoint(0,1,out dev);
        var iid=typeof(IAudioEndpointVolume).GUID; object o; dev.Activate(ref iid,23,IntPtr.Zero,out o);
        var vol=(IAudioEndpointVolume)o;
        vol.SetMasterVolumeLevel(-10.0f, Guid.Empty);
        for(int i=0;i<15;i++) {
            System.Threading.Thread.Sleep(200);
            float db; vol.GetMasterVolumeLevel(out db);
            float sc; vol.GetMasterVolumeLevelScalar(out sc);
            Console.WriteLine("+" + ((i+1)*200) + "ms " + Math.Round(db,1) + "dB " + Math.Round(sc*100) + "%");
            if (sc < 0.1f) { Console.WriteLine("*** ZEROED ***"); break; }
        }
    }
}
'@
[V]::Run()
