Write-Output "=== Dispositivos de audio (saida) ==="
Get-AudioDevice -List 2>$null | Where-Object { $_.Type -eq "Playback" } | Select-Object Index, Default, Name | Format-Table -AutoSize

if (-not (Get-Command Get-AudioDevice -ErrorAction SilentlyContinue)) {
    Write-Output "(cmdlet Get-AudioDevice nao disponivel - usando WMIC)"
    Get-CimInstance Win32_SoundDevice | Select-Object Name, StatusInfo | Format-Table -AutoSize
}

Write-Output ""
Write-Output "=== Audio via PowerShell MM ==="
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null

$code = @"
using System;
using System.Runtime.InteropServices;
public class AudioEnum {
    [DllImport("winmm.dll")]
    public static extern int waveOutGetNumDevs();
    [DllImport("winmm.dll", CharSet=CharSet.Unicode)]
    public static extern int waveOutGetDevCapsW(int uDeviceID, ref WAVEOUTCAPS pwoc, int cbwoc);
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct WAVEOUTCAPS {
        public short wMid;
        public short wPid;
        public int vDriverVersion;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)]
        public string szPname;
        public int dwFormats;
        public short wChannels;
        public short wReserved1;
        public int dwSupport;
    }
    public static void ListDevices() {
        int count = waveOutGetNumDevs();
        Console.WriteLine("Total saidas de audio: " + count);
        for (int i = -1; i < count; i++) {
            var caps = new WAVEOUTCAPS();
            int r = waveOutGetDevCapsW(i, ref caps, System.Runtime.InteropServices.Marshal.SizeOf(caps));
            if (r == 0) Console.WriteLine("  [" + i + "] " + caps.szPname + " (canais: " + caps.wChannels + ")");
        }
    }
}
"@
Add-Type -TypeDefinition $code
[AudioEnum]::ListDevices()
