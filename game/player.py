import discord

class Player:
    def __init__(self, user: discord.Member):
        self.user = user
        self.role = None
        self.faction = None
        self.alive = True
        self.votes = []

    # generates the role's PM
    @property
    def role_pm(self):
        return f'Hello {self.user}, you are a {self.faction} **{self.role}**. {self.role.description}'

    # remove vote by 'user' from player
    def remove_vote(self, user: discord.Member):
        self.votes = [*filter(lambda p: p.user.id != user.id, self.votes)]

    # check if player is voted by 'user'
    def has_vote(self, user: discord.Member):
        return any(player.user.id == user.id for player in self.votes)

    # remove a player from the game
    def remove(self):
        self.alive = False
        self.votes = []

