-- Agent 对话消息
DEFINE TABLE agent_message SCHEMAFULL;
DEFINE FIELD user_input ON agent_message TYPE string COMMENT '用户输入';
DEFINE FIELD response ON agent_message TYPE string DEFAULT '' COMMENT 'Agent 回复';
DEFINE FIELD attachments ON agent_message TYPE array DEFAULT [] COMMENT '附件';
DEFINE FIELD actions ON agent_message TYPE array DEFAULT [] COMMENT 'Actions';
DEFINE FIELD status ON agent_message TYPE string ASSERT $value IN ['pending', 'processing', 'done', 'error'] DEFAULT 'pending' COMMENT '状态';
DEFINE FIELD session_id ON agent_message TYPE string COMMENT '会话ID';
DEFINE FIELD created_by ON agent_message TYPE record<user> COMMENT '创建人';
DEFINE FIELD created_at ON agent_message TYPE datetime DEFAULT time::now();
DEFINE FIELD processed_at ON agent_message TYPE datetime DEFAULT NONE COMMENT '处理时间';
