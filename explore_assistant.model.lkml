connection: "@{LOOKER_BIGQUERY_CONNECTION_NAME}"
include: "/views/*.view.lkml"


datagroup: logging {
  interval_trigger: "0 second"
}
##### Explore Assistant #####

### Example, Refinement & Sample Fetching
explore: explore_assistant_examples {
  access_filter: {
    field: model_set
    user_attribute: explore_assistant_model_sets
  }
  # access_filter: {
  #   field: explore_id
  #   user_attribute: explore_assistant_model_sets
  # }
  join: explore_assistant_refinement_examples {
    type: left_outer
    relationship: one_to_one
    sql_on: ${explore_id} = ${explore_assistant_refinement_examples.explore_id} ;;
  }
  join: explore_assistant_samples {
    type: left_outer
    relationship: one_to_one
    sql_on: ${explore_id} = ${explore_assistant_samples.explore_id} ;;
  }
}


### BQML Model Access
explore: explore_assistant {}

### BQ Logging
explore: explore_assistant_logging {}

##### END #####
