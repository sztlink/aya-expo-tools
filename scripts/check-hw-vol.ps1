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
    [PreserveSig] int RegisterControlChangeNotify(IntPtr n);
    [PreserveSig] int UnregisterControlChangeNotify(IntPtr n);
    [PreserveSig] int GetChannelCount(out uint c);
    [PreserveSig] int SetMasterVolumeLevel(float levelDB, Guid g);
    [PreserveSig] int SetMasterVolumeLevelScalar(float l, Guid g);
    [PreserveSig] int GetMasterVolumeLevel(out float levelDB);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float l);
    [PreserveSig] int SetChannelVolumeLevel(uint ch, float levelDB, Guid g);
    [PreserveSig] int SetChannelVolumeLevelScalar(uint ch, float l, Guid g);
    [PreserveSig] int GetChannelVolumeLevel(uint ch, out float levelDB);
    [PreserveSig] int GetChannelVolumeLevelScalar(uint ch, out float l);
    [PreserveSig] int SetMute(bool m, Guid g);
    [PreserveSig] int GetMute(out bool m);
    [PreserveSig] int GetVolumeStepInfo(out uint step, out uint stepCount);
    [PreserveSig] int VolumeStepUp(Guid g);
    [PreserveSig] int VolumeStepDown(Guid g);
    [PreserveSig] int QueryHardwareSupport(out uint mask);
    [PreserveSig] int GetVolumeRange(out float minDB, out float maxDB, out float incDB);
}
public class HW {
    public static void Check() {
        var en=(IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice dev; en.GetDefaultAudioEndpoint(0,1,out dev);
        var iid=typeof(IAudioEndpointVolume).GUID; object o; dev.Activate(ref iid,23,IntPtr.Zero,out o);
        var vol=(IAudioEndpointVolume)o;
        uint mask; vol.QueryHardwareSupport(out mask);
        float minDB,maxDB,incDB; vol.GetVolumeRange(out minDB,out maxDB,out incDB);
        uint channels; vol.GetChannelCount(out channels);
        uint step,stepCount; vol.GetVolumeStepInfo(out step,out stepCount);
        float levelDB; vol.GetMasterVolumeLevel(out levelDB);
        float scalar; vol.GetMasterVolumeLevelScalar(out scalar);
        bool muted; vol.GetMute(out muted);
        Console.WriteLine("HW Support mask: " + mask + " (1=vol 2=mute 4=meter)");
        Console.WriteLine("Range: " + minDB + "dB to " + maxDB + "dB inc=" + incDB + "dB");
        Console.WriteLine("Channels: " + channels);
        Console.WriteLine("Step: " + step + "/" + stepCount);
        Console.WriteLine("Level: " + levelDB + "dB scalar=" + Math.Round(scalar*100) + "%");
        Console.WriteLine("Muted: " + muted);
        // Try set via dB level
        int hr1 = vol.SetMasterVolumeLevel(-10.0f, Guid.Empty);
        vol.GetMasterVolumeLevel(out levelDB);
        vol.GetMasterVolumeLevelScalar(out scalar);
        Console.WriteLine("After SetLevel(-10dB): HR=" + hr1 + " level=" + levelDB + "dB scalar=" + Math.Round(scalar*100) + "%");
        // Try VolumeStepUp
        for(int i=0;i<20;i++) vol.VolumeStepUp(Guid.Empty);
        vol.GetMasterVolumeLevelScalar(out scalar);
        Console.WriteLine("After 20x StepUp: scalar=" + Math.Round(scalar*100) + "%");
    }
}
'@
[HW]::Check()
