<div align="center">

<img src="../icon.svg" width="108" alt="dsh-myinfo"/>

# dsh-myinfo

**Un dossier personal de carácter local para [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — quién soy, qué he hecho, quién me rodea, qué he entendido y qué poseo.**

[![version](https://img.shields.io/badge/version-0.5.0-0071e3)](https://github.com/simonxluo/dsh-myinfo/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-34c759)](https://github.com/simonxluo/dsh-myinfo/blob/main/LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek_Harness-%E2%89%A5_0.2.1--rc.1-8957e5)](https://github.com/deepseek-ai/deepseek-harness)
[![platform](https://img.shields.io/badge/platform-Web_%7C_Desktop-8E8E93)](https://github.com/simonxluo/dsh-myinfo)

🇬🇧 [English](../README.md) · 🇨🇳 [简体中文](README.zh.md) · 🇯🇵 [日本語](README.ja.md) · 🇪🇸 **Español**

</div>

---

## Índice

- [Funciones](#funciones)
- [Un origen de datos, cinco superficies](#un-origen-de-datos-cinco-superficies)
- [Instalación](#instalación)
- [Privacidad](#privacidad)
- [Documentación](#documentación)
- [Desarrollo](#desarrollo)
- [Licencia](#licencia)

---

## Funciones

- **Identidad** — nombre / género / fecha de nacimiento (edad calculada automáticamente) / lugar de nacimiento / origen / residencia
- **Carrera** — empresa, puesto, periodo, contenido del trabajo y salario (el empleo actual se etiqueta solo)
- **Relaciones** — las personas de tu entorno y su relación contigo, con grupos y etiquetas
- **Reflexiones** — notas de vida archivadas en una línea de tiempo por fecha
- **Patrimonio** — tarjetas bancarias, saldos de Alipay / WeChat, efectivo y posiciones de cuentas de valores (p. ej. acciones A de THS), totalizados por divisa

## Un origen de datos, cinco superficies

Todas las superficies leen y escriben el mismo archivo local (`$DSH_HOME/integrations/dsh-myinfo/data.json`, permisos 0600 — nunca sale de tu máquina):

- **Herramientas del agente** — `personal_identity` / `personal_career` / `personal_relations` / `personal_reflections` / `personal_assets`; registra y consulta directamente desde el chat
- **Panel principal** (estética Apple) — el icono de perfil de la barra lateral abre un dossier a página completa con cabecera hero y un control segmentado de los cinco dominios
- **Overlay de activos** — una píldora de cristal esmerilado en la esquina inferior derecha muestra tu total neto; haz clic para la tarjeta rápida y un salto al panel; se actualiza cada minuto
- **Dock derecho** — un resumen compacto del perfil acoplado al panel derecho de la sesión (「Dock to right」 en el panel principal, o desde la página de guía del dock)
- **Sección de ajustes** — Ajustes de DSH → Personal Info, compartiendo los mismos formularios de cinco dominios
- **Aspecto** — el conmutador de tres estados 🌗 → ☀️ → 🌙 (seguir la app → claro → oscuro) en todas las superficies; los estados manuales anulan el tema del host con tokens literales y surten efecto de verdad, y el tercer clic vuelve a seguir la app

## Instalación

```sh
# añade el paquete por nombre en la página de plugins web / escritorio:
dsh-myinfo
# o desde la CLI:
dsh plugin --profile web add dsh-myinfo
```

## Privacidad

El repositorio en sí **no incluye ningún dato personal**; los datos en tiempo de ejecución viven solo bajo `$DSH_HOME`, y los archivos locales excluidos por `.gitignore` jamás entran al control de versiones.

## Documentación

- [Requisitos y modelado de datos](requirements.md)
- [Diseño de flujo de control / flujo de datos](design.md)
- [Informes de revisión multi-modelo](workflow-report.md)

## Desarrollo

```sh
npm test   # pruebas unitarias del host sobre un directorio temporal; nunca toca tu dossier real
```

## Licencia

[MIT](../LICENSE)
