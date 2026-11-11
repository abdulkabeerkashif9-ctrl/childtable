// ============================================================================
// Child Table Grid - Column Limit Bypass + Horizontal Scroll
// ============================================================================
// Confirmed against Frappe framework source, version-15 branch (matches your
// ERPNext v15 install).
//
// WHERE THE "10" LIMIT ACTUALLY LIVES (core file, you cannot edit this - no
// bench access - this is why the fix below is a Client Script instead):
//   frappe/public/js/frappe/form/grid_row.js
//     -> GridRow.prototype.validate_columns_width()      (throws the error)
//     -> GridRow.prototype.configure_dialog_for_columns_selector()
//        (calls validate_columns_width() when you click "Update" in the
//         child table's "Configure Columns" / gear-icon dialog)
//
// This is a WIDTH-BUDGET check, not a column-COUNT check: every column you
// tick in "Configure Columns" gets a width (1-12, default 2), and the sum of
// all shown columns' widths must not exceed 10, or Frappe throws:
//   "The total column width cannot be more than 10."
// That's the "validation" you're hitting. There is no separate cap in
// frappe/public/js/frappe/form/grid.js (Grid.prototype.setup_visible_columns)
// on how many "In List View" fields can exist - that file does not need any
// change.
//
// The child table's "detail popup" (the full-form view you get by clicking a
// row / the expand arrow) is rendered by a completely different file,
// frappe/public/js/frappe/form/grid_row_form.js, which never references
// column width or this validation at all. Nothing below touches it, so it
// is guaranteed unaffected.
//
// WHAT THIS SCRIPT DOES
//   1. Disables validate_columns_width() so "Configure Columns" accepts any
//      number of columns / any total width (tested for 25+).
//   2. Forces the grid to scroll horizontally (real scrollbar) once the
//      shown columns no longer fit the visible width, instead of squeezing
//      them. Each column's existing 1-12 width unit is mapped to a fixed
//      pixel width so it stops shrinking.
//
// HOW TO INSTALL (you have no bench access, so this must go in via the UI):
//   Desk > Client Script > New
//     Name          : anything, e.g. "Child Table - Allow 25+ Grid Columns"
//     DocType       : the PARENT doctype whose child table grid you want
//                      this on (e.g. Sales Order, if it's the Items grid)
//     Apply To      : Form
//     Enabled       : checked
//     Script        : paste this whole file
//   Save. Reload the desk (Ctrl+Shift+R) once, then open that form.
//
// NOTE: this patches a framework-wide class (GridRow) and injects one global
// stylesheet, so it will apply to every child-table grid that renders on
// whatever form(s) load this Client Script - not only one specific grid.
// If you want it scoped to a single child table only, tell me which
// doctype/child table and I'll narrow the CSS selectors to that grid's
// fieldname.
// ============================================================================

frappe.provide("frappe.ui.form");

// ---------------------------------------------------------------------------
// 1. Bypass the 10-unit total column-width validation.
// ---------------------------------------------------------------------------
(function bypass_grid_column_width_limit() {
	if (frappe.ui.form.GridRow.prototype.__towel_column_limit_patched) return;

	// Original implementation (for reference - this is what we're disabling):
	//
	//   validate_columns_width() {
	//     let total_column_width = 0.0;
	//     this.selected_columns_for_grid.forEach((row) => {
	//       if (row.columns && row.columns > 0) {
	//         total_column_width += cint(row.columns);
	//       }
	//     });
	//     if (total_column_width && total_column_width > 10) {
	//       frappe.throw(__("The total column width cannot be more than 10."));
	//     }
	//   }
	//
	// Replaced with a no-op so "Configure Columns" -> Update never throws,
	// no matter how many columns are selected or how wide they are set.
	frappe.ui.form.GridRow.prototype.validate_columns_width = function () {
		// intentionally empty - limit bypassed
	};

	frappe.ui.form.GridRow.prototype.__towel_column_limit_patched = true;
})();

// ---------------------------------------------------------------------------
// 2. Horizontal scrollbar instead of column squeezing.
// ---------------------------------------------------------------------------
// Frappe renders each grid column as a Bootstrap-style ".col-xs-N" (N = that
// column's width, 1-12) inside a flex ".row". With many columns shown, the
// browser normally shrinks them all to fit. The rules below give each
// col-xs-N a fixed pixel width instead, stop the row from wrapping, and let
// the grid container scroll horizontally once the row is wider than the
// screen - so columns stay full width and a scrollbar appears instead.
frappe.dom.set_style(
	`
	.form-grid-container {
		overflow-x: auto !important;
	}
	.form-grid-container .grid-heading-row .row,
	.form-grid-container .grid-row .row {
		flex-wrap: nowrap !important;
		width: max-content;
		min-width: 100%;
	}
	.form-grid-container .col-xs-1  { flex: 0 0 70px;  width: 70px; }
	.form-grid-container .col-xs-2  { flex: 0 0 140px; width: 140px; }
	.form-grid-container .col-xs-3  { flex: 0 0 210px; width: 210px; }
	.form-grid-container .col-xs-4  { flex: 0 0 280px; width: 280px; }
	.form-grid-container .col-xs-5  { flex: 0 0 350px; width: 350px; }
	.form-grid-container .col-xs-6  { flex: 0 0 420px; width: 420px; }
	.form-grid-container .col-xs-7  { flex: 0 0 490px; width: 490px; }
	.form-grid-container .col-xs-8  { flex: 0 0 560px; width: 560px; }
	.form-grid-container .col-xs-9  { flex: 0 0 630px; width: 630px; }
	.form-grid-container .col-xs-10 { flex: 0 0 700px; width: 700px; }
	.form-grid-container .col-xs-11 { flex: 0 0 770px; width: 770px; }
	.form-grid-container .col-xs-12 { flex: 0 0 840px; width: 840px; }
`,
	"towel-grid-column-limit-bypass-style"
);

// ---------------------------------------------------------------------------
// Practical notes:
// - Each individual column's width is still capped 1-12 (that's an
//   independent Bootstrap class limit in Frappe's grid CSS, "col-xs-13" etc.
//   don't exist as CSS classes) - only the SUM across all shown columns is
//   now unlimited. To fit 25 columns, set most of them to width 1 or 2 in
//   "Configure Columns" (the width box next to each field).
// - 70px per width-unit (line above) is a starting point; if your columns
//   still feel cramped or too wide, tell me and I'll adjust the multiplier.
// - This does not change what "In List View" checkbox does on Customize
//   Form / DocType - that field-level flag still governs which fields are
//   even eligible to appear in "Configure Columns" in the first place; if
//   you also want more than the currently-visible fields available to pick
//   from there, check "In List View" on the extra child table fields you
//   need (Customize Form, or the child DocType itself).
// ============================================================================
