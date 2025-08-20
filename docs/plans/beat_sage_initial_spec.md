## Goal

Create a web based rhythm based game utilizing the mono repo full stack framework.

## Services

- characterService (1 user to many characters)
  - Created by a user to act as their avatar
  - Props include
    - Name
    - HealthCurrent
    - HealthMax
    - ManaCore (manaService relation)
    - User (userService relation)
    - Skills (skillService relation)
- manaService (1 character to 1 mana)
  - Props include
    - current
    - maximum
    - experience
- skillService (1 character to many skills)
  - Props include
    - prefixes // array[] of SkillPrefixEnum
    - suffixes // array[] of SkillSuffixEnum
