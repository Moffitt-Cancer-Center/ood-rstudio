'use strict'

/**
 * Toggle visibility of advanced options based on checkbox state
 */
function toggle_advanced_options() {
  let show_advanced = $('#batch_connect_session_context_show_advanced').is(':checked');
  let auto_qos_group = $('#batch_connect_session_context_auto_qos').closest('.form-group');
  let auto_conda_group = $('#batch_connect_session_context_auto_conda').closest('.form-group');
  let reservation_group = $('#batch_connect_session_context_reservation').closest('.form-group');
  
  if (show_advanced) {
    auto_qos_group.show();
    auto_conda_group.show();
    reservation_group.show();
  } else {
    auto_qos_group.hide();
    auto_conda_group.hide();
    reservation_group.hide();
  }
}

$(document).ready(function() {
  // Initialize advanced options visibility
  toggle_advanced_options();
  
  // Handle show_advanced checkbox changes
  $('#batch_connect_session_context_show_advanced').on('change', function() {
    toggle_advanced_options();
  });
});
