Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator {}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection col);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice dev);
}
[Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection { [PreserveSig] int GetCount(out int c); [PreserveSig] int Item(int i, out IMMDevice d); }
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { [PreserveSig] int Activate(ref Guid id, int clsCtx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); int X1(); [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id); }
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume { int X1(); int X2(); [PreserveSig] int SetMasterVolumeLevelScalar(float l, Guid g); int X3(); [PreserveSig] int GetMasterVolumeLevelScalar(out float l); }
public class AE {
    public static void Test() {
        var en = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDeviceCollection col; en.EnumAudioEndpoints(0, 1, out col);
        int cnt; col.GetCount(out cnt);
        IMMDevice defDev; en.GetDefaultAudioEndpoint(0, 1, out defDev); string defId; defDev.GetId(out defId);
        for (int i = 0; i < cnt; i++) {
            IMMDevice d; col.Item(i, out d); string id; d.GetId(out id);
            var iid = typeof(IAudioEndpointVolume).GUID; object o; d.Activate(ref iid, 23, IntPtr.Zero, out o);
            var v = (IAudioEndpointVolume)o;
            v.SetMasterVolumeLevelScalar(0.8f, Guid.Empty);
            float lev; v.GetMasterVolumeLevelScalar(out lev);
            string def = (id == defId) ? " [DEFAULT]" : "";
            Console.WriteLine(i + def + " set=80 read=" + Math.Round(lev*100) + "% id=" + id.Substring(id.Length-8));
        }
    }
}
'@
[AE]::Test()
