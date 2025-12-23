'use strict';

/* globals jQuery */
/* @deprecated */

(function ($) {
    $(document).ready(function () {
        var $siteStatusRow = $('.site-status-row');
        var $cleanQueueBtn = $('.clean-queue-btn');
        var $resumeIndexingBtn = $('.resume-indexing-btn');
        var $dialogContainer = $('.dialog-container');

        /**
         * @description Opens dialog containing clean queue/resume indexing call response
         * @param {string} text Dialog text
         */
        function openResultDialog(text) {
            $dialogContainer.dialog({
                autoOpen: false,
                modal: true,
                buttons: [
                    {
                        text: $dialogContainer.data('confirm-btn-text'),
                        click: function () {
                            $(this).dialog('close');
                        }
                    }
                ],
                open: function () {
                    $('body').css({ overflow: 'hidden' });
                },
                beforeClose: function () {
                    $('body').css({ overflow: 'inherit' });
                }
            });

            $dialogContainer.text(text);
            $dialogContainer.dialog('open');
        }

        /**
         * @description Handles clean queue/resume indexing action buttons
         * @param {Object} e action button click event
         */
        function handleActionClick(e) {
            $.ajax({
                url: $(e.target).data('action-url'),
                type: 'post',
                dataType: 'json',
                success: function (data) {
                    if (data.errorMessage) {
                        openResultDialog(data.errorMessage);
                    } else {
                        openResultDialog($(e.target).data('success-msg'));
                    }
                },
                error: function () {
                    openResultDialog($(e.target).data('general-error-msg'));
                }
            });
        }

        $siteStatusRow.each(function () {
            var $siteItem = $(this);
            $.ajax({
                url: $siteItem.data('get-status-url'),
                type: 'get',
                dataType: 'json',
                success: function (data) {
                    $siteItem.find('.status-result').text(JSON.stringify(data));
                },
                error: function () {
                    var $statusResultContainer = $siteItem.find('.status-result');
                    $statusResultContainer.text($statusResultContainer.data('general-error-msg'));
                }
            });
        });

        $cleanQueueBtn.on('click', function (e) {
            $dialogContainer.dialog({
                autoOpen: false,
                modal: true,
                buttons: [
                    {
                        text: $dialogContainer.data('confirm-btn-text'),
                        click: function () {
                            handleActionClick(e);
                        }
                    },
                    {
                        text: $dialogContainer.data('cancel-btn-text'),
                        click: function () {
                            $(this).dialog('close');
                        }
                    }
                ],
                open: function () {
                    $('body').css({ overflow: 'hidden' });
                },
                beforeClose: function () {
                    $('body').css({ overflow: 'inherit' });
                }
            });

            $dialogContainer.text($(e.target).data('confirm-msg'));
            $dialogContainer.dialog('open');
        });

        // Disables the "Grouping attribute for the Attribute-sliced record model"
        // text input unless "Record model" is "Attribute-sliced"
        $('select#RecordModel').on('change', function() {
            var isAttributeSlicedRecordModelSelected = $(this).val() === 'attribute-sliced';
            $('input#AttributeSlicedRecordModel_GroupingAttribute').prop('disabled', !isAttributeSlicedRecordModelSelected);
        }).trigger('change');

        $resumeIndexingBtn.on('click', handleActionClick);

    });
}(jQuery));
