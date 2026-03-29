; AYA Expo Tools  Inno Setup Installer
; Setup.exe pequeno (~2MB) que l arquivos do pendrive e instala em C:\aya-expo-tools
; Pendrive layout: setup.exe + aya-expo-tools/ + node-portable/ + python-venv/ + models/ + installers/ + wg-config/

#define MyAppName "AYA Expo Tools"
#define MyAppVersion "2.0"
#define MyAppPublisher "AYA Studio"

[Setup]
AppId={{A1B2C3D4-AYA-EXPO-TOOLS}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\aya-expo-tools
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=AYA-Expo-Tools-Setup
Compression=lzma
SolidCompression=yes
SetupIconFile=icon\aya-icon.ico
UninstallDisplayIcon={app}\icon\aya-icon.ico
PrivilegesRequired=admin
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableWelcomePage=no

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
brazilianportuguese.WelcomeLabel2=Este assistente ira instalar o [name] no computador.%n%nInclui Node.js, Python com PyTorch CUDA, modelos de visao computacional e todas as dependencias.%n%nTempo estimado: 5-15 minutos.%n%nEspaco necessario: ~6 GB.

[Tasks]
Name: desktopicon; Description: "Criar icone na Area de Trabalho"; GroupDescription: "Atalhos:"
Name: autostart; Description: "Iniciar automaticamente com o Windows"; GroupDescription: "Opcoes:"
Name: wireguard; Description: "Instalar WireGuard VPN"; GroupDescription: "Componentes opcionais:"
Name: afterburner; Description: "Instalar MSI Afterburner"; GroupDescription: "Componentes opcionais:"
Name: defender; Description: "Adicionar exclusao no Windows Defender"; GroupDescription: "Seguranca:"

[Files]
; Somente arquivos pequenos embutidos no setup.exe
Source: "icon\aya-icon.ico"; DestDir: "{app}\icon"; Flags: ignoreversion
Source: "start-aya.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\start-aya.bat"; IconFilename: "{app}\icon\aya-icon.ico"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\start-aya.bat"; IconFilename: "{app}\icon\aya-icon.ico"; Tasks: desktopicon

[Run]
; Abrir o app aps instalar
Filename: "{app}\start-aya.bat"; Description: "Iniciar AYA Expo Tools"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "schtasks.exe"; Parameters: "/delete /tn ""AYA Expo Tools"" /f"; Flags: runhidden
Filename: "powershell.exe"; Parameters: "-Command ""Remove-MpPreference -ExclusionPath '{app}'"""; Flags: runhidden

[Code]
var
  SourceDir: String;

function GetSourceDir(): String;
begin
  Result := ExtractFilePath(ExpandConstant('{srcexe}'));
end;

procedure CopyWithProgress(Source, Dest, Msg: String);
var
  ResultCode: Integer;
begin
  WizardForm.StatusLabel.Caption := Msg;
  // robocopy: /s recurse /e include empty / /mt multi-thread /nfl no file list /ndl no dir list /njh no header /njs no summary
  Exec('robocopy.exe', '"' + Source + '" "' + Dest + '" /s /e /mt:4 /nfl /ndl /njh /njs', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  // robocopy returns 0-7 for success, 8+ for error
  if ResultCode >= 8 then
    MsgBox('Erro ao copiar ' + Source + ' (cdigo ' + IntToStr(ResultCode) + '). Verifique o pendrive.', mbError, MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Src: String;
begin
  if CurStep = ssInstall then
  begin
    Src := GetSourceDir();

    // 1. Cdigo da aplicao
    CopyWithProgress(Src + 'aya-expo-tools', ExpandConstant('{app}'), 'Copiando cdigo da aplicao...');

    // 2. Node.js portable
    CopyWithProgress(Src + 'node-portable\node-v22.14.0-win-x64', ExpandConstant('{app}\node'), 'Copiando Node.js...');

    // 3. Python venv (grande, ~5.3 GB)
    CopyWithProgress(Src + 'python-venv', ExpandConstant('{app}\clusters\cv\python\venv'), 'Copiando Python + PyTorch + CUDA (5.3 GB, pode demorar)...');

    // 4. Modelos ML
    CopyWithProgress(Src + 'models', ExpandConstant('{app}\clusters\cv\python\models'), 'Copiando modelos de viso computacional...');

    // 5. WireGuard config
    if DirExists(Src + 'wg-config') then
      CopyWithProgress(Src + 'wg-config', ExpandConstant('{app}\wg-config'), 'Copiando configurao WireGuard...');
  end;

  if CurStep = ssPostInstall then
  begin
    Src := GetSourceDir();

    // Windows Defender exclusion
    if WizardIsTaskSelected('defender') then
    begin
      WizardForm.StatusLabel.Caption := 'Adicionando excluso no Windows Defender...';
      Exec('powershell.exe', '-Command "Add-MpPreference -ExclusionPath ''' + ExpandConstant('{app}') + '''"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    // WireGuard install
    if WizardIsTaskSelected('wireguard') and FileExists(Src + 'installers\wireguard-installer.exe') then
    begin
      WizardForm.StatusLabel.Caption := 'Instalando WireGuard...';
      Exec(Src + 'installers\wireguard-installer.exe', '/S', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      // Import config
      if FileExists(ExpandConstant('{app}\wg-config\amano-rio.conf')) then
        Exec('powershell.exe', '-Command "& ''C:\Program Files\WireGuard\wireguard.exe'' /installtunnelservice ''' + ExpandConstant('{app}\wg-config\amano-rio.conf') + '''"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    // MSI Afterburner install
    if WizardIsTaskSelected('afterburner') and FileExists(Src + 'installers\MSIAfterburnerSetup.zip') then
    begin
      WizardForm.StatusLabel.Caption := 'Instalando MSI Afterburner...';
      Exec('powershell.exe', '-Command "Expand-Archive -Path ''' + Src + 'installers\MSIAfterburnerSetup.zip'' -DestinationPath ''' + Src + 'installers\afterburner'' -Force"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      // Try common setup executable names
      if FileExists(Src + 'installers\afterburner\MSIAfterburnerSetup465.exe') then
        Exec(Src + 'installers\afterburner\MSIAfterburnerSetup465.exe', '/S', '', SW_HIDE, ewWaitUntilTerminated, ResultCode)
      else if FileExists(Src + 'installers\afterburner\MSIAfterburnerSetup.exe') then
        Exec(Src + 'installers\afterburner\MSIAfterburnerSetup.exe', '/S', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    // Task Scheduler  auto-start
    if WizardIsTaskSelected('autostart') then
    begin
      WizardForm.StatusLabel.Caption := 'Configurando incio automtico...';
      Exec('schtasks.exe', '/create /tn "AYA Expo Tools" /tr "' + ExpandConstant('{app}\start-aya.bat') + '" /sc onlogon /rl highest /f', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;

function InitializeSetup(): Boolean;
var
  Src: String;
begin
  Src := GetSourceDir();
  // Verificar se os arquivos do pendrive existem
  if not DirExists(Src + 'aya-expo-tools') then
  begin
    MsgBox('Pasta "aya-expo-tools" no encontrada ao lado do instalador.' + #13#10 + #13#10 +
           'Certifique-se de que o setup.exe est no pendrive junto com as pastas:' + #13#10 +
           '  - aya-expo-tools\' + #13#10 +
           '  - node-portable\' + #13#10 +
           '  - python-venv\' + #13#10 +
           '  - models\', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  Result := True;
end;
