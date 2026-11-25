namespace BEAM.Web;

public sealed record EmulatorSystem(string Core, string Name, string[] Extensions, string Hint);

public static class EmulatorSystems
{
    public static readonly EmulatorSystem[] All =
    [
        new("fceumm", "Nintendo NES", [".nes", ".zip"], "NES cartridge ROM."),
        new("snes9x", "Super Nintendo", [".sfc", ".smc", ".zip"], "SNES cartridge ROM."),
        new("gambatte", "Game Boy / Game Boy Color", [".gb", ".gbc", ".zip"], "Game Boy or Game Boy Color cartridge ROM."),
        new("mgba", "Game Boy Advance", [".gba", ".zip"], "Game Boy Advance cartridge ROM."),
        new("genesis_plus_gx", "Sega Mega Drive / Genesis", [".md", ".gen", ".bin", ".zip"], "Mega Drive / Genesis cartridge ROM."),
        new("pcsx_rearmed", "PlayStation", [".chd", ".pbp", ".zip"], "Use CHD, PBP, or a ZIP containing CUE and its BIN tracks. A compatible BIOS may be required."),
        new("fbneo", "Arcade — FinalBurn Neo", [".zip"], "Use a complete ROM set matching FinalBurn Neo. Not every arcade game is supported."),
        new("mame2003_plus", "Arcade — MAME 2003 Plus", [".zip"], "Use a complete ROM set matching this core. Tekken Tag is not supported by the shipped build.")
    ];

    public static EmulatorSystem? Find(string? core) => All.SingleOrDefault(system => system.Core == core);
    public static readonly string[] CategoryIds = ["roms", "arcade", "fighter"];
}
