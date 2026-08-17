export const LEGAL_ENTITY_NAME = "Bright Ears Co., Ltd. (Head Office)";
export const COMPANY_REGISTRATION_NUMBER = "0105550096659";

export const REGISTERED_OFFICE_LINES = [
  LEGAL_ENTITY_NAME,
  "11/10, Moo 17, Soi Panjit 3, Garden Home Village",
  "Phahonyothin Road, Khu Khot, Lam Luk Ka",
  "Pathum Thani 12130, Thailand",
] as const;

export const REGISTERED_OFFICE = REGISTERED_OFFICE_LINES.join(", ");
