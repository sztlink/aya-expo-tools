Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport][Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MMDeviceEnumerator {}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection endpoints);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection {
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int Item(int index, out IMMDevice device);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    [PreserveSig] int Activate(ref Guid id, int clsCtx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
    int NotImpl1();
    [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int NotImpl2();
    [PreserveSig] int GetState(out int state);
}
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int NotImpl1(); int NotImpl2();
    [PreserveSig] int SetMasterVolumeLevelScalar(float level, Guid ctx);
    int NotImpl3();
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
    int NotImpl4(); int NotImpl5(); int NotImpl6(); int NotImpl7();
    [PreserveSig] int GetMute(out bool mute);
}
public class AllAudio {
    public static void ListEndpoints() {
        var en = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDeviceCollection col; en.EnumAudioEndpoints(0, 1, out col);
        int count; col.GetCount(out count);
        IMMDevice defDev; en.GetDefaultAudioEndpoint(0, 1, out defDev);
        string defId; defDev.GetId(out defId);
        for (int i = 0; i < count; i++) {
            IMMDevice dev; col.Item(i, out dev);
            string id; dev.GetId(out id);
            int state; dev.GetState(out state);
            var iid = typeof(IAudioEndpointVolume).GUID;
            object o; dev.Activate(ref iid, 23, IntPtr.Zero, out o);
            var vol = (IAudioEndpointVolume)o;
            float level; vol.GetMasterVolumeLevelScalar(out level);
            bool muted; vol.GetMute(out muted);
            string def = (id == defId) ? " [DEFAULT]" : "";
            Console.WriteLine("  " + id + def + "  vol=" + Math.Round(level*100) + "%  mute=" + muted + "  state=" + state);
        }
    }
}
'@ -ErrorAction Stop
[AllAudio]::ListEndpoints()
