# List all audio sessions and their volumes
Add-Type -TypeDefinition @'
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

[Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {
    int NotImpl1(); int NotImpl2();
    [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator enumerator);
}

[Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int GetSession(int index, out IAudioSessionControl session);
}

[Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl {
    int NotImpl1(); // QueryInterface handled by COM
    [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
}

[Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface ISimpleAudioVolume {
    [PreserveSig] int SetMasterVolume(float level, ref Guid ctx);
    [PreserveSig] int GetMasterVolume(out float level);
    [PreserveSig] int SetMute(bool mute, ref Guid ctx);
    [PreserveSig] int GetMute(out bool mute);
}
'@ -ErrorAction SilentlyContinue

# Simpler: use PowerShell cmdlets if available
# List processes that have audio sessions via netstat approach won't work
# Let's just check what's running that could control audio
Get-Process | Where-Object { $_.ProcessName -match 'Arena|nircmd|sndvol|audio|sound|chrome|edge|resolume' } | 
    Select-Object Id, ProcessName, StartTime, @{N='WorkingSetMB';E={[math]::Round($_.WorkingSet64/1MB)}} | 
    Format-Table -AutoSize

# Also check: is there a group policy for audio?
Write-Output "--- Communications Ducking ---"
$duck = Get-ItemProperty "HKCU:\Software\Microsoft\Multimedia\Audio" -Name "UserDuckingPreference" -ErrorAction SilentlyContinue
if ($duck) { Write-Output "Ducking: $($duck.UserDuckingPreference)" } else { Write-Output "No ducking preference set (default=reduce 80%)" }
