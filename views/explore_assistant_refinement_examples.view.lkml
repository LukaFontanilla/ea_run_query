view: explore_assistant_refinement_examples {
  sql_table_name: `@{EXPLORE_ASSISTANT_REFINEMENT_EXAMPLES_TABLE_NAME}` ;;

  dimension: examples {
    type: string
    description: "Examples for Explore Assistant training. JSON document with list hashes each with input and output keys."
    sql: ${TABLE}.examples ;;
  }
  dimension: explore_id {
    type: string
    description: "Explore id of the explore to pull examples for in a format of -\u003e lookml_model:lookml_explore"
    sql: ${TABLE}.explore_id ;;
  }
  measure: count {
    type: count
  }
}
