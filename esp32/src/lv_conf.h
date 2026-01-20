/**
 * @file lv_conf.h
 * Configuration file for v8.3.9
 */

#ifndef LV_CONF_H
#define LV_CONF_H

#include <stdint.h>

/*=========================
   STDLIB
 *=========================*/
#define LV_USE_STDLIB_MALLOC    1
#define LV_USE_STDLIB_STRING    1
#define LV_USE_STDLIB_SPRINTF   1

/*=========================
   COLOR SETTINGS
 *=========================*/
#define LV_COLOR_DEPTH 16
#define LV_COLOR_16_SWAP 1

/*=========================
   MEMORY SETTINGS
 *=========================*/
#define LV_MEM_CUSTOM 1
#define LV_MEM_SIZE (48 * 1024U)          /*[bytes]*/
#define LV_MEM_ADR 0     /*0: unused*/
#define LV_MEM_BUF_MAX_NUM 16

/*=========================
   HAL SETTINGS
 *=========================*/
#define LV_DISP_DEF_REFR_PERIOD 30      /*[ms]*/
#define LV_INDEV_DEF_READ_PERIOD 30     /*[ms]*/
#define LV_TICK_CUSTOM 1

/*=========================
   FEATURE CONFIGURATION
 *=========================*/

/*--- Drawing ---*/
#define LV_DRAW_COMPLEX 1
#define LV_SHADOW_CACHE_SIZE 0
#define LV_IMG_CACHE_DEF_SIZE 0

/*--- GPU ---*/
#define LV_USE_GPU_STM32_DMA2D 0
#define LV_USE_GPU_NXP_PXP 0

/*--- Logging ---*/
#define LV_USE_LOG 0

/*--- Asserts ---*/
#define LV_USE_ASSERT_NULL          1
#define LV_USE_ASSERT_MALLOC        1

/*--- Others ---*/
#define LV_USE_PERF_MONITOR 0
#define LV_USE_MEM_MONITOR 0

/*==================
 *    FONT USAGE
 *==================*/

/* The built-in fonts contains the ASCII range and some Symbols with 4 bpp. */
#define LV_FONT_MONTSERRAT_8  0
#define LV_FONT_MONTSERRAT_10 0
#define LV_FONT_MONTSERRAT_12 0
#define LV_FONT_MONTSERRAT_14 1
#define LV_FONT_MONTSERRAT_16 0
#define LV_FONT_MONTSERRAT_18 0
#define LV_FONT_MONTSERRAT_20 0
#define LV_FONT_MONTSERRAT_22 0
#define LV_FONT_MONTSERRAT_24 0
#define LV_FONT_MONTSERRAT_26 0
#define LV_FONT_MONTSERRAT_28 0
#define LV_FONT_MONTSERRAT_30 0
#define LV_FONT_MONTSERRAT_32 0
#define LV_FONT_MONTSERRAT_34 0
#define LV_FONT_MONTSERRAT_36 0
#define LV_FONT_MONTSERRAT_38 0
#define LV_FONT_MONTSERRAT_40 1
#define LV_FONT_MONTSERRAT_42 0
#define LV_FONT_MONTSERRAT_44 0
#define LV_FONT_MONTSERRAT_46 0
#define LV_FONT_MONTSERRAT_48 1

/* Enable handling large font and/or fonts with a lot of characters.
 * The limit depends on the font size, font face and bpp.
 * Compiler error will be triggered if a font needs it. */
#define LV_FONT_FMT_TXT_LARGE 1

/* Demonstrate special features */
#define LV_FONT_MONTSERRAT_12_SUBPX      0
#define LV_FONT_MONTSERRAT_28_COMPRESSED 0  /*bpp = 3*/
#define LV_FONT_DEJAVU_16_PERSIAN_HEBREW 0  /*Hebrew, Arabic, Persian letters and all their forms*/
#define LV_FONT_SIMSUN_16_CJK            0  /*1000 common CJK radicals*/

/*Pixel perfect monospace fonts*/
#define LV_FONT_UNISCII_8  0
#define LV_FONT_UNISCII_16 0

#define LV_FONT_DEFAULT &lv_font_montserrat_14

/*=========================
   THEME USAGE
 *=========================*/
#define LV_USE_THEME_DEFAULT 1
#define LV_THEME_DEFAULT_DARK 1
#define LV_THEME_DEFAULT_GROW 1
#define LV_THEME_DEFAULT_TRANSITION_TIME 80

/*=========================
   WIDGETS
 *=========================*/
#define LV_USE_BTN 1
#define LV_USE_LABEL 1
#define LV_USE_BAR 1
#define LV_USE_SLIDER 1
#define LV_USE_SWITCH 1
#define LV_USE_TEXTAREA 1
#define LV_USE_DROPDOWN 1
#define LV_USE_IMG 1
#define LV_USE_LINE 1
#define LV_USE_TABLE 1
#define LV_USE_CHECKBOX 1
#define LV_USE_MSGBOX 1

/*=========================
   EXTRA / LAYOUT
 *=========================*/
#define LV_USE_FLEX 1
#define LV_USE_GRID 1

#endif /*LV_CONF_H*/
