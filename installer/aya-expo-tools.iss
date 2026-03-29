; AYA Expo Tools v2.1 — Instalador Unico
; Setup.exe leve (~2MB) que copia tudo do pendrive para C:\aya-expo-tools
; Atalho aponta para aya-expo-tools.exe (Tauri app nativo)

#define MyAppName "AYA Expo Tools"
#define MyAppVersion "2.1.0"
#define MyAppPublisher "AYA Studio"
#define MyAppExeName "aya-expo-tools.exe"

[Setup]
AppId={{A1B2C3D4-AYA-EXPO-TOOLS}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\aya-expo-tools
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=AYA-Expo-Tools-v2.1-Setup
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
brazilianportuguese.WelcomeLabel2=Este assistente ira instalar o [name] no computador.%n%nInclui o aplicativo, Node.js, Python com PyTorch CUDA, modelos de visao computacional e todas as dependencias.%n%nTempo estimado: 5-15 minutos.%n%nEspaco necessario: ~6 GB.

[Tasks]
Name: desktopicon; Description: "Criar icone na Area de Trabalho"; GroupDescription: "Atalhos:"
Name: autostart; Description: "Iniciar automaticamente com o Windows"; GroupDescription: "Opcoes:"
Name: wireguard; Description: "Instalar WireGuard VPN"; GroupDescription: "Componentes opcionais:"
Name: afterburner; Description: "Instalar MSI Afterburner"; GroupDescription: "Componentes opcionais:"
Name: defender; Description: "Adicionar exclusao no Windows Defender"; GroupDescription: "Seguranca:"

[Files]
; Somente icone e start script embutidos no setup.exe
Source: "icon\aya-icon.ico"; DestDir: "{app}\icon"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon\aya-icon.ico"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon\aya-icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar AYA Expo Tools"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "schtasks.exe"; Parameters: "/delete /tn ""AYA Expo Tools"" /f"; Flags: runhidden
Filename: "powershell.exe"; Parameters: "-Command ""Remove-MpPreference -ExclusionPath '{app}'"""; Flags: runhidden

[Code]
function GetSourceDir(): String;
begin
  Result := ExtractFilePath(ExpandConstant('{srcexe}'));
end;

procedure CopyDir(Source, Dest, Msg: String);
var
  ResultCode: Integer;
begin
  WizardForm.StatusLabel.Caption := Msg;
  WizardForm.ProgressGauge.Style := npbstMarquee;
  ForceDirectories(Dest);
  Exec('robocopy.exe', '"' + Source + '" "' + Dest + '" /s /e /mt:4 /nfl /ndl /njh /njs /r:1 /w:1', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  WizardForm.ProgressGauge.Style := npbstNormal;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Src: String;
begin
  if CurStep = ssInstall then
  begin
    Src := GetSourceDir();

    CopyDir(Src + 'aya-expo-tools', ExpandConstant('{app}'), 'Etapa 1/4 — Copiando aplicacao (10 segundos)...');

    CopyDir(Src + 'node-portable\node-v22.14.0-win-x64', ExpandConstant('{app}\node'), 'Etapa 2/4 — Copiando Node.js (10 segundos)...');

    CopyDir(Src + 'python-venv', ExpandConstant('{app}\clusters\cv\python\venv'), 'Etapa 3/4 — Copiando Python + PyTorch CUDA (5 GB — aguarde 3-8 minutos)...');

    CopyDir(Src + 'models', ExpandConstant('{app}\clusters\cv\python\models'), 'Etapa 4/4 — Copiando modelos de IA (10 segundos)...');

    if DirExists(Src + 'wg-config') then
      CopyDir(Src + 'wg-config', ExpandConstant('{app}\wg-config'), 'Copiando configuracao WireGuard...');
  end;

  if CurStep = ssPostInstall then
  begin
    Src := GetSourceDir();

    if WizardIsTaskSelected('defender') then
    begin
      WizardForm.StatusLabel.Caption := 'Configurando Windows Defender...';
      Exec('powershell.exe', '-Command "Add-MpPreference -ExclusionPath ''' + ExpandConstant('{app}') + '''"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    if WizardIsTaskSelected('wireguard') and FileExists(Src + 'installers\wireguard-installer.exe') then
    begin
      WizardForm.StatusLabel.Caption := 'Instalando WireGuard...';
      Exec(Src + 'installers\wireguard-installer.exe', '/S', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      if FileExists(ExpandConstant('{app}\wg-config\amano-rio.conf')) then
        Exec('powershell.exe', '-Command "& ''C:\Program Files\WireGuard\wireguard.exe'' /installtunnelservice ''' + ExpandConstant('{app}\wg-config\amano-rio.conf') + '''"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    if WizardIsTaskSelected('afterburner') and FileExists(Src + 'installers\MSIAfterburnerSetup.zip') then
    begin
      WizardForm.StatusLabel.Caption := 'Instalando MSI Afterburner...';
      Exec('powershell.exe', '-Command "Expand-Archive -Path ''' + Src + 'installers\MSIAfterburnerSetup.zip'' -DestinationPath ''' + Src + 'installers\afterburner'' -Force"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      if FileExists(Src + 'installers\afterburner\MSIAfterburnerSetup.exe') then
        Exec(Src + 'installers\afterburner\MSIAfterburnerSetup.exe', '/S', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    if WizardIsTaskSelected('autostart') then
    begin
      WizardForm.StatusLabel.Caption := 'Configurando inicio automatico...';
      Exec('schtasks.exe', '/create /tn "AYA Expo Tools" /tr "' + ExpandConstant('{app}\{#MyAppExeName}') + '" /sc onlogon /rl highest /f', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;

function InitializeSetup(): Boolean;
var
  Src: String;
begin
  Src := GetSourceDir();
  if not DirExists(Src + 'aya-expo-tools') then
  begin
    MsgBox('Pasta "aya-expo-tools" nao encontrada ao lado do instalador.' + #13#10 + #13#10 +
           'O setup.exe deve estar na raiz do pendrive junto com:' + #13#10 +
           '  aya-expo-tools\' + #13#10 +
           '  node-portable\' + #13#10 +
           '  python-venv\' + #13#10 +
           '  models\', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  Result := True;
end;
