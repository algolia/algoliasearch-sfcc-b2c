'use strict';

/* globals jQuery */

(function ($) {
    $(document).ready(function () {
        // Disables the "Grouping attribute for the Attribute-sliced record model"
        // text input unless "Record model" is "Attribute-sliced"
        $('select#RecordModel').on('change', function() {
            let isAttributeSlicedRecordModelSelected = $(this).val() === 'attribute-sliced';
            $('input#AttributeSlicedRecordModel_GroupingAttribute').prop('readonly', !isAttributeSlicedRecordModelSelected);
        }).trigger('change');

        // Disables the "Analytics Region" text input unless "Indexing API" is "Ingestion API"
        $('select#IndexingAPI').on('change', function() {
            let isIngestionAPISelected = $(this).val() === 'ingestion-api';
            $('input#AnalyticsRegion').prop('readonly', !isIngestionAPISelected);
        }).trigger('change');

        // "Select All" / "Select None" preset buttons next to the "Active data for custom ranking"
        // checkbox group. data-select-state="all" checks every box, "none" unchecks every box.
        $('.js-active-data-toggle').on('click', function () {
            let shouldCheck = $(this).data('select-state') === 'all';
            $('input[name="ActiveData"]').prop('checked', shouldCheck);
        });
    });
}(jQuery));
