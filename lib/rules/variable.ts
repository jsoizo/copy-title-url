const NAME = String.raw`[A-Za-z_$][\w$]*`;

export const VARIABLE_NAME = new RegExp(`^${NAME}$`);
export const VARIABLE_NAME_PREFIX = new RegExp(`^${NAME}`);
