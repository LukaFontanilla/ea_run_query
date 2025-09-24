view: explore_assistant_logging {
  derived_table: {
    datagroup_trigger: logging
    create_process: {
      sql_step:
      INSERT @{EXPLORE_ASSISTANT_LOGGING_TABLE_NAME} (
      user
      , model
      , explore
      , question
      , explore_url
      , timestamp
      )
      VALUES(
       {% parameter user %}
      ,{% parameter model %}
      ,{% parameter explore %}
      ,{% parameter question %}
      ,{% parameter explore_url %}
      ,{% parameter timestamp %}
      );;
      sql_step: CREATE TABLE IF NOT EXISTS ${SQL_TABLE_NAME} (col string) ;;
      sql_step: SELECT 1 as col FROM ${SQL_TABLE_NAME} ;;
      }
    }
    dimension: col {
      type: string
      sql: ${TABLE}.col ;;
    }
    parameter: user {
      type: string
      default_value: ""
    }
    parameter: model {
      type: string
      default_value: ""
    }
    parameter: explore {
      type: string
      default_value: ""
    }
    parameter: question {
      type: string
      default_value: ""
    }
    parameter: explore_url {
      type: string
      default_value: ""
    }
    parameter: timestamp {
      type: string
      default_value: ""
    }
  }
